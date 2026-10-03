// Key config loaded from backend
let validKeys = ['1', '2', '8', '9'];

// Load key config from server
fetch('/api/config')
    .then(r => r.json())
    .then(cfg => {
        const k = cfg.keys;
        validKeys = [k.player1_ja, k.player1_nein, k.player2_ja, k.player2_nein];
    })
    .catch(() => {}); // fallback to defaults

// Every keydown is sent immediately — both players often press at the same
// time, so no key may be held back or merged with another.
document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // OS key repeat
    if (!validKeys.includes(e.key)) return;
    if (typeof socket !== 'undefined') {
        socket.emit('keypress', { key: e.key });
    }
});
