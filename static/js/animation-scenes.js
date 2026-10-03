/**
 * AnimationScenes — Choreography for each game moment
 * Uses CutoutAnimator primitives for Gilliam-style paper cutout animations
 */
const AnimationScenes = {
    _basePath: '/static/img/cutouts/',
    _lastThumb: 'woman',

    /** Sprüche im leeren Schild der Konsensomat-Maschine (Übergangsbildschirm) */
    _machineSayings: [
        'Fragen werden berechnet …',
        'Zahnräder werden geölt …',
        'Meinungen werden vorgewärmt …',
        'Kompromisse werden gebügelt …',
        'Ja und Nein werden sortiert …',
        'Dampfdruck wird auf Demokratie gestellt …',
        'Argumente werden poliert …',
        'Gegenargumente werden auch poliert …',
        'Zwickmühlen werden gezwickt …',
        'Einigkeit wird vorgeheizt …',
        'Wackelige Fragen werden festgeschraubt …',
        'Glühbirnen denken nach …',
        'Abstimmungsknöpfe werden entstaubt …',
        'Pendel sucht die goldene Mitte …',
        'Streitgespräche werden aufgewärmt …',
        'Gute Laune wird nachgefüllt …',
        '„Vielleicht“ wird aussortiert …',
        'Fragezeichen werden geradegebogen …',
        'Konsens wird eingekocht …',
        'Diskussionsstoff wird zugeschnitten …',
        'Mehrheiten werden gezählt … und nachgezählt …',
        'Schrauben werden demokratisch gewählt …',
        'Ventile üben Pfeifen …',
        'Zuhören wird kalibriert …',
        'Neugier wird hochgefahren …',
        'Gedankenwolken werden abgelassen …',
        'Spickzettel werden eingesammelt …',
        'Bauchgefühl wird gewogen …',
        'Die Maschine fragt sich selbst …',
        'Gleich geht’s los — nicht drängeln!',
    ],

    /** Shuffled copy of the sayings (Fisher-Yates) */
    _shuffledSayings() {
        const list = this._machineSayings.slice();
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    },

    /**
     * Machine image plus a text display in its blank sign, in one container
     * so the text moves and wobbles with the machine.
     */
    _spawnMachine(width, x, y) {
        const wrap = document.createElement('div');
        wrap.className = 'machine-wrap';
        wrap.style.width = width + 'px';
        const img = document.createElement('img');
        img.src = this._img('objects/wartemaschine.png');
        img.draggable = false;
        const display = document.createElement('div');
        display.className = 'machine-display';
        // Blank sign in wartemaschine.png (1024×1207): x 225–680, y 732–875
        Object.assign(display.style, {
            left: (225 / 1024 * 100) + '%',
            top: (732 / 1207 * 100) + '%',
            width: (455 / 1024 * 100) + '%',
            height: (143 / 1207 * 100) + '%',
            fontSize: (width * 0.034) + 'px',
        });
        const text = document.createElement('span');
        display.appendChild(text);
        wrap.append(img, display);
        gsap.set(wrap, { x, y, transformOrigin: 'center center' });
        CutoutAnimator._layer.appendChild(wrap);
        return { wrap, text };
    },

    /** Cycle through sayings until the element leaves the DOM */
    _runSayings(textEl, startDelay, interval) {
        const sayings = this._shuffledSayings();
        let i = 0;
        const show = () => {
            if (!textEl.isConnected) return false;
            gsap.to(textEl, {
                opacity: 0, duration: 0.25, onComplete: () => {
                    textEl.textContent = sayings[i++ % sayings.length];
                    gsap.to(textEl, { opacity: 1, duration: 0.25 });
                },
            });
            return true;
        };
        setTimeout(() => {
            if (!show()) return;
            const timer = setInterval(() => { if (!show()) clearInterval(timer); }, interval);
        }, startDelay);
    },

    _img(sub) {
        return this._basePath + sub;
    },

    /** Preload all cutout images during idle */
    preload() {
        CutoutAnimator.preloadImages([
            this._img('characters/announcer.png'),
            this._img('characters/figure-thinking-left.png'),
            this._img('characters/figure-thinking-right.png'),
            this._img('characters/figure-arguing-left.png'),
            this._img('characters/figure-arguing-right.png'),
            this._img('characters/figure-cheering-left.png'),
            this._img('characters/figure-cheering-right.png'),
            this._img('objects/thumbs-up-man.png'),
            this._img('objects/thumbs-up-woman.png'),
            this._img('objects/gavel.png'),
            this._img('objects/trophy.png'),
            this._img('objects/wartemaschine.png'),
            this._img('objects/pendel.png'),
            this._img('objects/zahnrad.png'),
            this._img('objects/steam.png'),
            this._img('objects/bulb_off.png'),
            this._img('objects/bulb_on.png'),
            this._img('objects/gameover.png'),
            this._img('decorative/curtain-left.png'),
            this._img('decorative/curtain-right.png'),
            this._img('decorative/foot.png'),
            this._img('decorative/countdown-3.png'),
            this._img('decorative/countdown-2.png'),
            this._img('decorative/countdown-1.png'),
            this._img('decorative/countdown-go.png'),
        ]);
    },

    /**
     * Curtain geometry — both images are exact mirror images (1024×1536),
     * so equal visible widths make the stage exactly symmetric.
     */
    _curtainLayout() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = vh * 1024 / 1536;
        const visible = vh * 0.56;  // keeps the tie-back in view; stage = --stage-w in style.css
        return { height: vh, width, visible, leftX: visible - width, rightX: vw - visible };
    },

    _spawnCurtains() {
        const c = this._curtainLayout();
        const opts = { y: 0, height: c.height, transformOrigin: 'center top' };
        return [
            CutoutAnimator.spawn(this._img('decorative/curtain-left.png'), { ...opts, x: c.leftX }),
            CutoutAnimator.spawn(this._img('decorative/curtain-right.png'), { ...opts, x: c.rightX }),
        ];
    },

    /** Idle screen — curtains + announcer with wobble */
    idle() {
        CutoutAnimator.clearAll();
        const vh = window.innerHeight;
        const u = CutoutAnimator.u();
        const c = this._curtainLayout();

        const [curtainL, curtainR] = this._spawnCurtains();

        // Announcer stands in front of the left curtain, pointing at the stage
        const announcer = CutoutAnimator.spawn(this._img('characters/announcer.png'), {
            x: c.visible - 470 * u, y: vh - 650 * u, width: 500 * u,
        });

        CutoutAnimator.addWobble(curtainL, 0.5);
        CutoutAnimator.addWobble(curtainR, 0.5);
        CutoutAnimator.addWobble(announcer, 1.2);
    },

    /** Game start — curtains slide out */
    gameStart() {
        CutoutAnimator.clearAll();

        // Start exactly where the idle curtains hang, then open
        const [curtainL, curtainR] = this._spawnCurtains();

        CutoutAnimator.slideOut(curtainL, 'left', 0.6);
        CutoutAnimator.slideOut(curtainR, 'right', 0.6);
    },

    /** Countdown before game starts — 3, 2, 1, LOS! with cutout images */
    countdown(onComplete) {
        const overlay = document.getElementById('countdown-overlay');
        const imgFiles = [
            'decorative/countdown-3.png',
            'decorative/countdown-2.png',
            'decorative/countdown-1.png',
            'decorative/countdown-go.png',
        ];
        let i = 0;
        const self = this;

        overlay.innerHTML = '';
        overlay.classList.add('active');
        gsap.set(overlay, { opacity: 1 });

        function showNext() {
            if (i >= imgFiles.length) {
                gsap.to(overlay, { opacity: 0, duration: 0.3, onComplete: () => {
                    overlay.classList.remove('active');
                    overlay.innerHTML = '';
                    if (onComplete) onComplete();
                }});
                return;
            }

            overlay.innerHTML = '';
            const img = document.createElement('img');
            img.src = self._img(imgFiles[i]);
            img.style.maxWidth = '70vw';
            img.style.maxHeight = '80vh';
            overlay.appendChild(img);

            gsap.fromTo(img,
                { scale: 3, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' }
            );
            gsap.to(img, { opacity: 0, scale: 0.3, duration: 0.25, delay: 0.65 });

            i++;
            setTimeout(showNext, 1000);
        }

        showNext();
    },

    /**
     * Konsensomat transition — steampunk machine with pendulum, gear, and steam.
     */
    transition(duration) {
        CutoutAnimator.clearAll();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const u = CutoutAnimator.u();

        // --- Sizing ---
        const machineDisplayH = vh * 0.75;
        const machineNatW = 1024, machineNatH = 1207;
        const scale = machineDisplayH / machineNatH;
        const machineDisplayW = machineNatW * scale;

        const machineX = (vw - machineDisplayW) / 2;
        const machineY = (vh - machineDisplayH) / 2 + vh * 0.05;

        // --- Pendel ---
        const pendelNatH = 1115;
        const pendelDisplayH = machineDisplayH * 0.45;
        const pendelScale = pendelDisplayH / pendelNatH;
        const pendelDisplayW = 274 * pendelScale;
        const pendelPivotX = 125 * pendelScale;
        const pendelPivotY = 75 * pendelScale;
        const pendelX = machineX + 770 * scale - pendelPivotX;
        const pendelY = machineY + 650 * scale - pendelPivotY;

        // --- Zahnrad ---
        const zahnradNatH = 1536;
        const zahnradDisplayH = machineDisplayH * 0.25;
        const zahnradScale = zahnradDisplayH / zahnradNatH;
        const zahnradDisplayW = 1024 * zahnradScale;
        const zahnradCenterX = 500 * zahnradScale;
        const zahnradCenterY = 725 * zahnradScale;
        const zahnradX = machineX + 925 * scale - zahnradCenterX;
        const zahnradY = machineY + 500 * scale - zahnradCenterY;

        // --- Steam spawn point ---
        const steamOriginX = machineX + machineDisplayW * 0.72;
        const steamOriginY = machineY - 20 * u;

        // === SPAWN off-screen ===
        const { wrap: machine, text: machineText } =
            this._spawnMachine(machineDisplayW, -machineDisplayW - 100 * u, machineY);
        this._runSayings(machineText, 900, 2200);
        const pendel = CutoutAnimator.spawn(this._img('objects/pendel.png'), {
            x: -pendelDisplayW - 200 * u, y: -pendelDisplayH, width: pendelDisplayW,
            transformOrigin: pendelPivotX + 'px ' + pendelPivotY + 'px',
        });
        const zahnrad = CutoutAnimator.spawn(this._img('objects/zahnrad.png'), {
            x: -zahnradDisplayW - 200 * u, y: vh + 100 * u, width: zahnradDisplayW,
            transformOrigin: zahnradCenterX + 'px ' + zahnradCenterY + 'px',
        });

        // === ENTER ===
        const enterTl = gsap.timeline();
        enterTl.to(machine, {
            x: machineX, duration: 1.4, ease: 'power2.out',
        }, 0);
        enterTl.to(pendel, {
            x: pendelX, y: pendelY, duration: 1.0, ease: 'power2.out',
        }, 0.3);
        enterTl.to(zahnrad, {
            x: zahnradX, y: zahnradY, duration: 1.0, ease: 'power2.out',
        }, 0.5);
        CutoutAnimator.track(enterTl);

        // --- Bulbs: 3 off, then switch on left to right ---
        const bulbNatPositions = [
            { x: 330, y: 425 },
            { x: 430, y: 425 },
            { x: 530, y: 425 },
        ];
        const bulbDisplayH = 150 * scale;
        const bulbTargets = bulbNatPositions.map(pos => ({
            x: machineX + pos.x * scale - bulbDisplayH / 2,
            y: machineY + pos.y * scale - bulbDisplayH / 2,
        }));
        const bulbs = bulbTargets.map(target => {
            return CutoutAnimator.spawn(this._img('objects/bulb_off.png'), {
                x: target.x, y: target.y,
                height: bulbDisplayH,
                opacity: 0,
            });
        });

        // Fade bulbs in with machine
        enterTl.to(bulbs, { opacity: 1, duration: 0.5 }, 1.0);

        // Track all bulb elements for exit animation
        const allBulbEls = [...bulbs];

        // === RUNNING ===
        const runDelay = 1.6;

        // Switch bulbs on one by one (evenly spread across the transition)
        const bulbInterval = (duration - 4) / 3;
        bulbs.forEach((bulb, i) => {
            setTimeout(() => {
                const target = bulbTargets[i];
                const onBulb = CutoutAnimator.spawn(this._img('objects/bulb_on.png'), {
                    x: target.x, y: target.y,
                    height: bulbDisplayH,
                    opacity: 0,
                });
                allBulbEls.push(onBulb);
                gsap.to(onBulb, { opacity: 1, duration: 0.3 });
                gsap.to(bulb, { opacity: 0, duration: 0.3 });
            }, (runDelay + i * bulbInterval) * 1000);
        });

        // Pendel — smooth swing
        const pendelSwing = gsap.timeline({ repeat: -1, yoyo: true, delay: runDelay });
        pendelSwing.to(pendel, { rotation: 25, duration: 1.2, ease: 'sine.inOut' });
        pendelSwing.to(pendel, { rotation: -25, duration: 1.2, ease: 'sine.inOut' });
        CutoutAnimator.track(pendelSwing);

        // Zahnrad — smooth continuous rotation
        const gearSpin = gsap.timeline({ repeat: -1, delay: runDelay });
        gearSpin.to(zahnrad, { rotation: 360, duration: 4, ease: 'none' });
        CutoutAnimator.track(gearSpin);

        // Machine gentle wobble
        setTimeout(() => CutoutAnimator.addWobble(machine, 0.3), runDelay * 1000);

        // Steam puffs
        const steamInterval = setInterval(() => {
            this._spawnSteamPuff(steamOriginX, steamOriginY);
        }, 1800);
        setTimeout(() => this._spawnSteamPuff(steamOriginX, steamOriginY), runDelay * 1000);

        // === EXIT ===
        const exitTime = (duration - 2) * 1000;
        setTimeout(() => {
            clearInterval(steamInterval);
            const exitTl = gsap.timeline();
            exitTl.to(machine, { x: vw + 100 * u, duration: 1.2, ease: 'power2.in' }, 0);
            exitTl.to(pendel, { x: vw + 200 * u, y: -pendelDisplayH, duration: 0.9, ease: 'power2.in' }, 0.1);
            exitTl.to(zahnrad, { x: vw + 200 * u, y: vh + 100 * u, duration: 0.9, ease: 'power2.in' }, 0.2);

            // Bulbs fly out wildly spinning in random directions
            allBulbEls.forEach((bulb, i) => {
                const angle = Math.random() * 360;
                const dist = vw * 0.5 + Math.random() * vw * 0.5;
                const targetX = parseFloat(gsap.getProperty(bulb, 'x')) + Math.cos(angle * Math.PI / 180) * dist;
                const targetY = parseFloat(gsap.getProperty(bulb, 'y')) + Math.sin(angle * Math.PI / 180) * dist;
                const spin = (Math.random() > 0.5 ? 1 : -1) * (720 + Math.random() * 1080);
                exitTl.to(bulb, {
                    x: targetX, y: targetY,
                    rotation: spin,
                    opacity: 0,
                    duration: 0.8 + Math.random() * 0.4,
                    ease: 'power2.in',
                }, i * 0.1);
            });

            CutoutAnimator.track(exitTl);
        }, Math.max(exitTime, 3000));
    },

    /** Spawn a single steam puff that rises and fades */
    _spawnSteamPuff(originX, originY) {
        const u = CutoutAnimator.u();
        const steamSize = (80 + Math.random() * 40) * u;
        const xOffset = (Math.random() - 0.5) * 60 * u;

        const puff = CutoutAnimator.spawn(this._img('objects/steam.png'), {
            x: originX + xOffset, y: originY,
            width: steamSize, opacity: 0.7,
        });

        const tl = gsap.timeline();
        tl.to(puff, {
            y: originY - (200 + Math.random() * 150) * u,
            x: originX + xOffset + (Math.random() - 0.5) * 120 * u,
            scale: 2.5 + Math.random(),
            opacity: 0,
            duration: 3,
            ease: 'power1.out',
            onComplete: () => CutoutAnimator.despawn(puff),
        });
        CutoutAnimator.track(tl);
    },

    /** New question — thinking figures slide in from sides */
    votingEnter() {
        CutoutAnimator.clearAll();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const u = CutoutAnimator.u();

        const figL = CutoutAnimator.spawn(this._img('characters/figure-thinking-left.png'), {
            width: 320 * u, y: vh - 580 * u,
        });
        const figR = CutoutAnimator.spawn(this._img('characters/figure-thinking-right.png'), {
            width: 320 * u, y: vh - 580 * u,
        });

        CutoutAnimator.slideIn(figL, 'left', { x: -60 * u, duration: 0.6 });
        CutoutAnimator.slideIn(figR, 'right', { x: vw - 260 * u, duration: 0.6 });

        setTimeout(() => {
            CutoutAnimator.addWobble(figL, 1);
            CutoutAnimator.addWobble(figR, 1);
        }, 700);
    },

    /** Agreement — thumbs-up pops in center, bounces, fades */
    agreement() {
        CutoutAnimator.clearAll();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const u = CutoutAnimator.u();

        this._lastThumb = this._lastThumb === 'man' ? 'woman' : 'man';
        const thumbFile = 'objects/thumbs-up-' + this._lastThumb + '.png';
        const thumb = CutoutAnimator.spawn(this._img(thumbFile), {
            width: 280 * u, x: vw / 2 - 140 * u, y: vh / 2 + 20 * u, opacity: 0,
        });

        CutoutAnimator.popIn(thumb);
        const bounce = gsap.timeline({ delay: 0.4 });
        bounce.to(thumb, { y: vh / 2 - 30 * u, duration: 0.25, ease: 'power2.out' });
        bounce.to(thumb, { y: vh / 2 + 20 * u, duration: 0.2, ease: 'bounce.out' });
        bounce.to(thumb, { opacity: 0, duration: 0.4, ease: 'power1.in', delay: 0.5 });
        CutoutAnimator.track(bounce);
    },

    /** Disagreement — arguing figures slam in, gavel drops */
    disagreement() {
        CutoutAnimator.clearAll();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const u = CutoutAnimator.u();

        const figL = CutoutAnimator.spawn(this._img('characters/figure-arguing-left.png'), {
            width: 340 * u, y: vh - 600 * u,
        });
        const figR = CutoutAnimator.spawn(this._img('characters/figure-arguing-right.png'), {
            width: 340 * u, y: vh - 600 * u,
        });

        CutoutAnimator.slideIn(figL, 'left', { x: -70 * u, duration: 0.4 });
        CutoutAnimator.slideIn(figR, 'right', { x: vw - 270 * u, duration: 0.4 });

        // Gavel lands right next to the debate timer. Deferred one tick:
        // the debate screen only becomes visible after this scene starts.
        setTimeout(() => {
            const timer = document.getElementById('debate-timer').getBoundingClientRect();
            const gavelW = 250 * u;
            // gavel.png: visible head starts at 18% width, centred at 43% height
            const gavel = CutoutAnimator.spawn(this._img('objects/gavel.png'), {
                width: gavelW, x: timer.right + 40 * u - gavelW * 0.18,
            });
            CutoutAnimator.stompDown(gavel, timer.top + timer.height / 2 - gavelW * 1.5 * 0.43);
            setTimeout(() => CutoutAnimator.hingeMotion(gavel, 'right bottom', '', 12, 0.5), 500);
        }, 0);

        setTimeout(() => {
            CutoutAnimator.addWobble(figL, 2);
            CutoutAnimator.addWobble(figR, 2);
        }, 500);
    },

    /** Debate getting urgent — ramp up wobble intensity */
    debateUrgent() {
        const imgs = document.querySelectorAll('#animation-layer img');
        imgs.forEach(img => {
            CutoutAnimator.addWobble(img, 4);
        });
    },

    /** Game over — gameover.png slides in, then Monty Python foot stomps it */
    gameOver() {
        CutoutAnimator.clearAll();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const u = CutoutAnimator.u();

        // Game over sign — centered in the upper part, text sits below (style.css)
        const goW = vh * 0.7;
        const goImg = CutoutAnimator.spawn(this._img('objects/gameover.png'), {
            width: goW, x: vw / 2 - goW / 2, y: vh + 50 * u,
        });

        // Rise up from bottom
        const riseTl = gsap.timeline();
        riseTl.to(goImg, {
            y: vh * 0.1,
            duration: 1.0,
            ease: 'power2.out',
        });
        CutoutAnimator.track(riseTl);
        setTimeout(() => CutoutAnimator.addWobble(goImg, 1), 1100);

        // After a pause, foot stomps down on top
        setTimeout(() => {
            const footW = vh * 0.62;
            const foot = CutoutAnimator.spawn(this._img('decorative/foot.png'), {
                width: footW,
                x: vw / 2 - footW / 2,
                transformOrigin: 'center top',
            });
            CutoutAnimator.stompDown(foot, vh * 0.05);
        }, 2000);
    },

    /** Score screen — trophy rises, cheering figures */
    scoreScreen(score, total) {
        CutoutAnimator.clearAll();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const u = CutoutAnimator.u();

        const trophy = CutoutAnimator.spawn(this._img('objects/trophy.png'), {
            width: 300 * u, x: vw / 2 - 150 * u, y: vh + 50 * u,
        });

        const rise = gsap.timeline();
        rise.to(trophy, {
            y: 30 * u,
            duration: 1.0,
            ease: 'power2.out',
        });
        CutoutAnimator.track(rise);
        CutoutAnimator.addWobble(trophy, 1);

        const figL = CutoutAnimator.spawn(this._img('characters/figure-cheering-left.png'), {
            width: 320 * u, y: vh - 580 * u,
        });
        const figR = CutoutAnimator.spawn(this._img('characters/figure-cheering-right.png'), {
            width: 320 * u, y: vh - 580 * u,
        });

        CutoutAnimator.slideIn(figL, 'left', { x: -60 * u, duration: 0.7 });
        CutoutAnimator.slideIn(figR, 'right', { x: vw - 260 * u, duration: 0.7 });

        setTimeout(() => {
            CutoutAnimator.addWobble(figL, 2);
            CutoutAnimator.addWobble(figR, 2);
        }, 800);
    },
};
