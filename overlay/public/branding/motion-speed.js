(function (global) {
    'use strict';
    var KEY = 'pterodactyl:motion-speed';
    var EVENT = 'panel-motion-speed-change';
    var DEFAULT = 0.5;
    var speed = DEFAULT;

    function parse(value) {
        var number = value === null || value === '' ? DEFAULT : Number(value);
        return isFinite(number) ? Math.min(1.5, Math.max(0.25, number)) : DEFAULT;
    }
    function scale(animation) {
        animation.updatePlaybackRate(speed);
    }
    function apply(value) {
        speed = value;
        document.documentElement.setAttribute('data-motion-speed', String(speed));
        document.getAnimations().forEach(scale);
        document.querySelectorAll('[data-motion-speed-control]').forEach(function (input) {
            input.value = String(speed);
        });
        document.querySelectorAll('[data-motion-speed-value]').forEach(function (output) {
            output.textContent = speed.toFixed(2).replace(/0$/, '') + '×';
        });
        global.dispatchEvent(new CustomEvent(EVENT, { detail: speed }));
    }
    function setSpeed(value) {
        var next = parse(value);
        if (next === speed) return;
        try { global.localStorage.setItem(KEY, String(next)); } catch (e) { /* Keep the current page usable when storage is unavailable. */ }
        apply(next);
    }
    var stored = null;
    try { stored = global.localStorage.getItem(KEY); } catch (e) { /* Use the default speed. */ }
    global.PanelMotion = { getSpeed: function () { return speed; }, setSpeed: setSpeed, scale: scale };
    apply(parse(stored));
    function started(event) {
        event.target.getAnimations({ subtree: true }).forEach(scale);
    }
    document.addEventListener('animationstart', started, true);
    document.addEventListener('transitionrun', started, true);
    document.addEventListener('input', function (event) {
        if (event.target.matches('[data-motion-speed-control]')) setSpeed(event.target.value);
    });
    global.addEventListener('storage', function (event) {
        if (event.key === KEY || event.key === null) apply(parse(event.newValue));
    });
}(window));
