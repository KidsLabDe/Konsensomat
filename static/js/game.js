const socket = io();

let previousPhase = null;
let categoriesLoaded = false;
let debateUrgentTriggered = false;
let tickStarted = false;
let gameMode = null; // 'online' | 'offline'
let autoOnline = false;

// Green keys (Ja) = select, Red keys (Nein) = next
let greenKeys = ['1', '8'];
let redKeys = ['2', '9'];
let allCategories = [];
let focusedIndex = 0; // currently highlighted category

// Load key config
fetch('/api/config')
    .then(r => r.json())
    .then(cfg => {
        const k = cfg.keys;
        greenKeys = [k.player1_ja, k.player2_ja];
        redKeys = [k.player1_nein, k.player2_nein];
        autoOnline = !!cfg.auto_online;
    })
    .catch(() => {});

// --- Load categories and build list ---
function loadCategories() {
    fetch('/api/categories')
        .then(r => r.json())
        .then(categories => {
            allCategories = categories.concat([null]); // null = "Alle Kategorien"
            focusedIndex = 0;
            buildCategoryList();
            categoriesLoaded = true;
        });
}

function buildCategoryList() {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = '';

    allCategories.forEach((cat, i) => {
        const el = document.createElement('div');
        el.className = 'category-option' + (i === focusedIndex ? ' focused' : '');
        const label = cat || 'Alle Kategorien';
        el.innerHTML = `<span class="category-label">${label}</span>`;
        grid.appendChild(el);
    });
}

function focusNext() {
    focusedIndex = (focusedIndex + 1) % allCategories.length;
    buildCategoryList();
}

function selectFocused() {
    const options = document.querySelectorAll('.category-option');
    if (options[focusedIndex]) {
        options[focusedIndex].classList.add('selected');
    }
    startGame(allCategories[focusedIndex]);
}

function startGame(category) {
    AudioManager.start();
    AnimationScenes.gameStart();
    AnimationScenes.countdown(() => {
        socket.emit('start_game', { category: category });
    });
}

function restartGame() {
    socket.emit('restart_game', {});
}

// --- Screen management ---
function showScreen(phase) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + phase);
    if (screen) {
        screen.classList.add('active');
    }
}

// --- Vote indicator helpers ---
function voteIndicator(player, showVotes) {
    if (!player.has_voted) return '\u23F3';
    if (!showVotes) return '\u2714';
    return player.vote === 'ja' ? '\uD83D\uDC4D Ja' : '\uD83D\uDC4E Nein';
}

function voteClass(player, showVotes) {
    if (!player.has_voted) return '';
    if (!showVotes) return 'voted';
    return player.vote === 'ja' ? 'ja' : 'nein';
}

// --- Tutorial animation on idle screen ---
function startTutorial() {
    const steps = document.querySelectorAll('.tutorial-step');
    let current = 0;

    function showStep() {
        steps.forEach((s, i) => {
            s.classList.toggle('visible', i === current);
        });
        current = (current + 1) % steps.length;
    }

    showStep();
    setInterval(showStep, 4000);
}

// --- Menu action from server (button press on idle) ---
socket.on('menu_action', (data) => {
    if (data.action === 'select' && data.key) {
        if (redKeys.includes(data.key)) {
            focusNext();
        } else if (greenKeys.includes(data.key)) {
            selectFocused();
        }
    }
});

// --- Handle game state updates ---
socket.on('game_state', (state) => {
    const phase = state.phase;
    const showVotes = state.players.every(p => p.has_voted);

    // Phase transition sounds + animations
    if (previousPhase !== phase) {
        debateUrgentTriggered = false;
        tickStarted = false;
        AudioManager.stop('tick');

        if (phase === 'idle') {
            AnimationScenes.idle();
        } else if (phase === 'transition') {
            if (state.transition_reason === 'agreement') {
                // After agreement: thumbs-up first, then machine
                AnimationScenes.agreement();
                AudioManager.agreement();
                setTimeout(() => {
                    AnimationScenes.transition(state.timer_total);
                    AudioManager.transition();
                }, 1800);
            } else {
                // First question or timeout: machine directly
                AnimationScenes.transition(state.timer_total);
                AudioManager.transition();
            }
        } else if (phase === 'voting') {
            CutoutAnimator.clearAll();
            setTimeout(() => AnimationScenes.votingEnter(), 200);
            AudioManager.voting();
        } else if (phase === 'debate') {
            AnimationScenes.disagreement();
            AudioManager.buzzer();
        } else if (phase === 'game_over') {
            AnimationScenes.gameOver();
            AudioManager.alarm();
            // Stomp sound when foot drops (2s delay matches animation)
            setTimeout(() => AudioManager.stomp(), 2000);
        } else if (phase === 'score_screen') {
            AnimationScenes.scoreScreen(state.score, state.total_questions);
            AudioManager.score();
        }

        // Flash effects
        if (phase === 'voting' && previousPhase === 'transition' && state.transition_reason === 'agreement') {
            const screen = document.getElementById('screen-voting');
            screen.classList.add('flash-agree');
            setTimeout(() => screen.classList.remove('flash-agree'), 600);
        }

        if (phase === 'debate' && previousPhase === 'voting') {
            const screen = document.getElementById('screen-debate');
            screen.classList.add('flash-disagree');
            setTimeout(() => screen.classList.remove('flash-disagree'), 600);
        }
    }

    // Tick sound: 6s long, start once at 6 seconds remaining
    if ((phase === 'voting' || phase === 'debate') && state.timer_remaining === 6 && !tickStarted) {
        tickStarted = true;
        AudioManager.tick();
    }

    // Load categories when idle; reset mode selection on every idle entry
    if (phase === 'idle') {
        loadCategories();
        if (previousPhase !== 'idle') {
            resetModeSelection();
        }
    }

    showScreen(phase);

    // Update transition screen
    if (phase === 'transition') {
        document.getElementById('transition-question-number').textContent =
            `Frage ${state.question_number}/${state.total_questions}`;
        document.getElementById('transition-score-display').textContent =
            state.score > 0 ? `Punkte: ${state.score}` : '';
    }

    // Update voting screen
    if (phase === 'voting') {
        document.getElementById('question-text').textContent = state.question || '';
        document.getElementById('question-number').textContent =
            `Frage ${state.question_number}/${state.total_questions}`;
        document.getElementById('score-display').textContent = `Punkte: ${state.score}`;
        document.getElementById('timer-label').textContent = `${state.timer_remaining}s`;

        const pct = state.timer_total > 0
            ? (state.timer_remaining / state.timer_total) * 100
            : 0;
        document.getElementById('timer-bar').style.width = pct + '%';

        const p1 = state.players[0];
        const p2 = state.players[1];
        const ind1 = document.getElementById('p1-indicator');
        const ind2 = document.getElementById('p2-indicator');
        ind1.textContent = voteIndicator(p1, showVotes);
        ind2.textContent = voteIndicator(p2, showVotes);
        ind1.className = 'vote-indicator ' + voteClass(p1, showVotes);
        ind2.className = 'vote-indicator ' + voteClass(p2, showVotes);
    }

    // Update debate screen
    if (phase === 'debate') {
        document.getElementById('debate-question-text').textContent = state.question || '';
        document.getElementById('debate-question-number').textContent =
            `Frage ${state.question_number}/${state.total_questions}`;
        document.getElementById('debate-score-display').textContent = `Punkte: ${state.score}`;

        const timerEl = document.getElementById('debate-timer');
        timerEl.textContent = state.timer_remaining;
        timerEl.classList.toggle('urgent', state.timer_remaining <= 10);

        if (state.timer_remaining <= 10 && !debateUrgentTriggered) {
            debateUrgentTriggered = true;
            AnimationScenes.debateUrgent();
        }

        const p1 = state.players[0];
        const p2 = state.players[1];
        const ind1 = document.getElementById('debate-p1-indicator');
        const ind2 = document.getElementById('debate-p2-indicator');
        ind1.textContent = voteIndicator(p1, showVotes);
        ind2.textContent = voteIndicator(p2, showVotes);
        ind1.className = 'vote-indicator ' + voteClass(p1, showVotes);
        ind2.className = 'vote-indicator ' + voteClass(p2, showVotes);
    }

    // Update game over screen
    if (phase === 'game_over') {
        document.getElementById('gameover-score').textContent = state.score;
    }

    // Update score screen
    if (phase === 'score_screen') {
        document.getElementById('final-score').textContent = state.score;
        const total = state.total_questions;
        const agreements = state.agreements;
        const msg = agreements === total
            ? 'Perfekt! Ihr seid euch in allem einig!'
            : `${agreements} von ${total} Fragen einig \u2014 ${state.score} Punkte!`;
        document.getElementById('score-message').textContent = msg;
    }

    previousPhase = phase;
});

// --- Mode selection ---
function resetModeSelection() {
    if (autoOnline) {
        selectMode('online');
        return;
    }
    gameMode = null;
    document.getElementById('mode-selection').style.display = '';
    document.getElementById('category-grid').style.display = 'none';
    document.getElementById('selection-hint').style.display = 'none';
    document.getElementById('qr-area').style.display = 'none';
}

function selectMode(mode) {
    gameMode = mode;
    document.getElementById('mode-selection').style.display = 'none';
    document.getElementById('category-grid').style.display = '';
    if (mode === 'offline') {
        document.getElementById('selection-hint').style.display = '';
    }
    if (mode === 'online') {
        document.getElementById('qr-area').style.display = '';
        showQrCodes();
    }
}

function showQrCodes() {
    [1, 2].forEach(p => {
        const url = location.protocol + '//' + location.host + '/buzzer/' + p;
        document.getElementById('qr-url-p' + p).textContent = url;
        const container = document.getElementById('qr-p' + p);
        container.innerHTML = '';
        new QRCode(container, {
            text: url,
            width: 180,
            height: 180,
            colorDark: '#eeeeee',
            colorLight: '#1a1a2e',
            correctLevel: QRCode.CorrectLevel.H
        });
    });
}

document.getElementById('btn-offline').addEventListener('click', () => selectMode('offline'));
document.getElementById('btn-online').addEventListener('click', () => selectMode('online'));

// Load categories on first connect
loadCategories();

// Initialize animation engine
CutoutAnimator.init();
AnimationScenes.preload();

// Start tutorial animation
startTutorial();
