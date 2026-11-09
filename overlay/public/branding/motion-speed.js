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
    /* 每個動畫只調整一次速度：同一個動畫被重複呼叫 updatePlaybackRate 時，瀏覽器每次都要重新同步它
       （合成器上的動畫會被取消再重啟），在很多動畫同時開始時（例如切換深淺色）會造成卡頓 */
    var applied = typeof WeakMap === 'function' ? new WeakMap() : null;
    function scale(animation) {
        if (applied && applied.get(animation) === speed) return;
        if (applied) applied.set(animation, speed);
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
    /* 新開始的 CSS 動畫／轉場：只處理觸發事件的那個元素（偽元素 ::before／::after 的動畫才需要往下找），
       不用每次都掃整個子樹 */
    function started(event) {
        var target = event.target;
        if (!target || !target.getAnimations) return;
        var list = event.pseudoElement ? target.getAnimations({ subtree: true }) : target.getAnimations();
        list.forEach(scale);
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
