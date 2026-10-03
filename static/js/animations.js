/**
 * CutoutAnimator — Gilliam-style paper cutout animation engine
 * Uses GSAP for smooth animations with subtle stop-motion character
 */
const CutoutAnimator = {
    _layer: null,
    _timelines: [],
    _imageCache: {},

    init() {
        this._layer = document.getElementById('animation-layer');
    },

    /** Layout unit: 1 at 1080p, 2 at 2160p — all pixel sizes in scenes are multiplied by it */
    u() {
        return window.innerHeight / 1080;
    },

    /** Rendered width of a spawned element (falls back while the image is still loading) */
    _width(el) {
        return el.offsetWidth || 600 * this.u();
    },

    /** Preload images into browser cache */
    preloadImages(paths) {
        paths.forEach(src => {
            if (!this._imageCache[src]) {
                const img = new Image();
                img.src = src;
                this._imageCache[src] = img;
            }
        });
    },

    /** Create an <img> element on the overlay */
    spawn(src, props = {}) {
        const img = document.createElement('img');
        img.src = src;
        img.draggable = false;
        if (props.width) img.style.width = props.width + 'px';
        if (props.height) img.style.height = props.height + 'px';
        gsap.set(img, {
            x: props.x || 0,
            y: props.y || 0,
            opacity: props.opacity !== undefined ? props.opacity : 1,
            scale: props.scale || 1,
            rotation: props.rotation || 0,
            transformOrigin: props.transformOrigin || 'center center',
        });
        this._layer.appendChild(img);
        return img;
    },

    /** Remove an element from the overlay */
    despawn(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    },

    /** Kill all tracked timelines and remove all overlay elements */
    clearAll() {
        this._timelines.forEach(tl => tl.kill());
        this._timelines = [];
        if (this._layer) {
            this._layer.innerHTML = '';
        }
    },

    /** Register a GSAP timeline for cleanup */
    track(timeline) {
        this._timelines.push(timeline);
        return timeline;
    },

    // --- Gilliam Primitives ---

    /** Subtle rotation wobble — gentle paper cutout feel */
    addWobble(el, intensity = 1.5) {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(el, {
            rotation: intensity,
            duration: 0.8 + Math.random() * 0.4,
            ease: 'sine.inOut',
        });
        tl.to(el, {
            rotation: -intensity,
            duration: 0.8 + Math.random() * 0.4,
            ease: 'sine.inOut',
        });
        this.track(tl);
        return tl;
    },

    /** Smooth slide in from offscreen */
    slideIn(el, from, toProps = {}) {
        const startProps = {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 50 * this.u();

        if (from === 'left') startProps.x = -this._width(el) - margin;
        else if (from === 'right') startProps.x = vw + margin;
        else if (from === 'top') startProps.y = -el.offsetHeight - margin;
        else if (from === 'bottom') startProps.y = vh + margin;

        gsap.set(el, startProps);
        const tl = gsap.timeline();
        tl.to(el, {
            ...toProps,
            duration: toProps.duration || 0.8,
            ease: 'power2.out',
        });
        this.track(tl);
        return tl;
    },

    /** Smooth slide out to offscreen */
    slideOut(el, to, duration = 0.6) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const target = {};
        const margin = 50 * this.u();

        if (to === 'left') target.x = -this._width(el) - margin;
        else if (to === 'right') target.x = vw + margin;
        else if (to === 'top') target.y = -el.offsetHeight - margin;
        else if (to === 'bottom') target.y = vh + margin;

        const tl = gsap.timeline();
        tl.to(el, {
            ...target,
            duration: duration,
            ease: 'power2.in',
            onComplete: () => this.despawn(el),
        });
        this.track(tl);
        return tl;
    },

    /** Hinge-point rotation (arms, jaw, limbs) */
    hingeMotion(el, originX, originY, angle, duration = 0.6) {
        gsap.set(el, { transformOrigin: originX + ' ' + originY });
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(el, {
            rotation: angle,
            duration: duration,
            ease: 'sine.inOut',
        });
        this.track(tl);
        return tl;
    },

    /** Snappy pop-in with overshoot */
    popIn(el) {
        gsap.set(el, { scale: 0, opacity: 0 });
        const tl = gsap.timeline();
        tl.to(el, {
            scale: 1.15,
            opacity: 1,
            duration: 0.25,
            ease: 'back.out(3)',
        });
        tl.to(el, {
            scale: 1,
            duration: 0.15,
            ease: 'power2.out',
        });
        this.track(tl);
        return tl;
    },

    /** Monty Python foot stomp from above */
    stompDown(el, targetY) {
        gsap.set(el, { y: -(el.offsetHeight || 800 * this.u()), scaleY: 1 });
        const tl = gsap.timeline();
        // Fast drop
        tl.to(el, {
            y: targetY,
            duration: 0.25,
            ease: 'power4.in',
        });
        // Squash on impact
        tl.to(el, {
            scaleY: 0.75,
            scaleX: 1.12,
            duration: 0.06,
            ease: 'none',
        });
        // Bounce back
        tl.to(el, {
            scaleY: 1,
            scaleX: 1,
            duration: 0.2,
            ease: 'elastic.out(1, 0.4)',
        });
        this.track(tl);
        return tl;
    },
};
