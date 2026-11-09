/**
 * 彩虹世界（淺色模式 + 彩虹）：進入時的慶祝動畫、按下時的泡泡。
 *
 * 進入時（約 2.7 秒，跟著全域動畫速度）：
 * - 從點擊的位置噴出一圈點陣光點（和深淺色開關同一種像素風格，顏色是整條光譜）
 * - 冒出幾顆肥皂泡往上飄，最後輕輕破掉
 * - 一道大彩虹從左到右畫過天空，停一下再淡出；一道斜斜的稜鏡光帶從左上掃到右下
 * - 玻璃與卡片由近到遠依序輕輕鼓起再回彈（像果凍的波），邊上閃出四角星光
 * - 所有點陣圖示的像素從四周飛進來重新組成（由近到遠依序）
 * - 全部用 canvas 畫，不下載任何圖片：網路快慢看到的都一樣
 * - 以實際經過的時間計算位置：效能較差的裝置只會少畫幾幀，動畫的速度、路徑、長度都一樣
 * - 時間跟著全域動畫速度（PanelMotion）；系統「減少動態效果」時不播放
 * - 播完就把 canvas 移除，平常沒有任何成本
 */

interface Spark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    hue: number;
    /** 顏色字串（色相固定，先算好：每一幀都重新組字串會多出上百次顏色解析） */
    color: string;
    life: number;
    delay: number;
}

interface Bubble {
    x: number;
    y: number;
    r: number;
    vy: number;
    sway: number;
    phase: number;
    hue: number;
    life: number;
    delay: number;
}

const reduced = (): boolean =>
    !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 固定的亂數種子：每個人、每次看到的都是同一場動畫（不因裝置或時間而不同） */
const seeded = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};

/** 一顆肥皂泡：透明的球，邊緣一圈薄膜色（色相沿著半徑轉），左上一點白色高光 */
const paintBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue: number, alpha: number) => {
    const film = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
    film.addColorStop(0, 'rgba(255,255,255,0)');
    film.addColorStop(0.7, `hsla(${hue},95%,72%,${0.22 * alpha})`);
    film.addColorStop(0.86, `hsla(${hue + 120},95%,70%,${0.4 * alpha})`);
    film.addColorStop(1, `hsla(${hue + 240},95%,72%,${0.55 * alpha})`);
    ctx.fillStyle = film;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.85 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
};

/** 破掉：一圈往外擴散的細環 */
const paintPop = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue: number, q: number) => {
    ctx.strokeStyle = `hsla(${hue},90%,65%,${0.7 * (1 - q)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + q * 0.6), 0, Math.PI * 2);
    ctx.stroke();
};

const rainbowWorld = (): boolean => {
    const root = document.documentElement;
    return root.getAttribute('data-theme') === 'light' && root.getAttribute('data-accent') === 'rainbow';
};

let running: (() => void) | null = null;

export const celebrateRainbow = (origin?: { x: number; y: number }): void => {
    if (typeof document === 'undefined' || reduced()) return;
    if (running) running();

    const W = window.innerWidth;
    const H = window.innerHeight;
    const ox = origin ? origin.x : W / 2;
    const oy = origin ? origin.y : 40;
    const rnd = seeded(20261109);
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const canvas = document.createElement('canvas');
    canvas.className = 'sys-rainbow-burst';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        canvas.remove();
        return;
    }

    /* 點陣光點：往四周噴開，受一點重力與空氣阻力，越飛越淡 */
    const sparks: Spark[] = [];
    for (let i = 0; i < 140; i++) {
        const a = rnd() * Math.PI * 2;
        const v = 260 + rnd() * 720;
        const hue = (a / (Math.PI * 2)) * 360;
        sparks.push({
            x: ox,
            y: oy,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 120,
            size: 3 + Math.round(rnd() * 4),
            hue,
            // 色相不會變（只有透明度在變）：字串先組好，和每一幀重新組出來的完全一樣
            color: `hsl(${hue},92%,58%)`,
            life: 0.9 + rnd() * 0.6,
            delay: rnd() * 0.12,
        });
    }

    /* 泡泡：從點擊位置附近冒出，搖擺著往上飄，最後破掉 */
    const bubbles: Bubble[] = [];
    for (let i = 0; i < 18; i++) {
        bubbles.push({
            x: ox + (rnd() - 0.5) * Math.min(520, W * 0.6),
            y: Math.min(H - 40, oy + 60 + rnd() * Math.min(420, H * 0.5)),
            r: 10 + rnd() * 26,
            vy: 70 + rnd() * 90,
            sway: 8 + rnd() * 16,
            phase: rnd() * Math.PI * 2,
            hue: rnd() * 360,
            life: 1.6 + rnd() * 1.0,
            delay: 0.05 + rnd() * 0.45,
        });
    }

    /* 畫面上看得到的玻璃與卡片（星光的位置、果凍波的對象） */
    const surfaces = Array.from(document.querySelectorAll<HTMLElement>('.lg, .sys-card'))
        .filter((el) => !el.closest('.sys-lens, .sys-tip, .sys-rainbow-burst'))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 24 && r.height > 16 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W)
        .slice(0, 48);

    /* 星光：在玻璃與卡片的邊上閃一下（四角星） */
    const stars = Array.from({ length: surfaces.length ? 30 : 0 }, () => {
        const { r } = surfaces[Math.floor(rnd() * surfaces.length)];
        const onTop = rnd() < 0.6;
        return {
            x: r.left + 12 + rnd() * Math.max(0, r.width - 24),
            y: onTop ? r.top + 2 : r.top + 8 + rnd() * Math.max(0, r.height - 16),
            size: 5 + rnd() * 7,
            delay: 0.35 + rnd() * 1.3,
            life: 0.5 + rnd() * 0.3,
        };
    });

    /* 彩虹：畫面下方為圓心的一道大彩虹，從左到右畫出來，停一下再淡出 */
    const arcR = Math.max(W * 0.56, H * 0.82);
    const arcCx = W / 2;
    const arcCy = H * 1.08;
    const band = Math.max(9, Math.min(W, H) * 0.017);
    const ARC_HUES = [0, 30, 52, 140, 205, 265];

    /* 果凍波：玻璃與卡片由近到遠依序輕輕鼓起再回彈（疊加在元素原本的 transform 上，播完就移除） */
    surfaces.forEach(({ el, r }) => {
        const dist = Math.hypot(r.left + r.width / 2 - ox, r.top + r.height / 2 - oy);
        const big = Math.max(r.width, r.height);
        // 越大的元素鼓起的比例越小，看起來每個都是差不多幾個像素
        const k = Math.min(0.035, 10 / big);
        try {
            const anim = el.animate(
                [
                    { transform: 'scale(1)' },
                    { transform: `scale(${1 + k})`, offset: 0.32 },
                    { transform: `scale(${1 - k * 0.35})`, offset: 0.62 },
                    { transform: 'scale(1)' },
                ],
                { duration: 680, delay: 200 + dist / 1.5, easing: 'ease-out', composite: 'add' }
            );
            if (window.PanelMotion) window.PanelMotion.scale(anim);
        } catch (e) {
            // 不支援疊加 transform 的瀏覽器：略過這一段
        }
    });

    /* 點陣圖示：像素從四周飛進來重新組成（PixelIcon.tsx 監聽這個事件） */
    window.dispatchEvent(new CustomEvent('sys-rainbow-enter', { detail: { x: ox, y: oy } }));

    const end = Math.max(
        2.7,
        ...sparks.map((s) => s.delay + s.life),
        ...bubbles.map((b) => b.delay + b.life),
        ...stars.map((st) => st.delay + st.life)
    ) + 0.25;
    const start = performance.now();
    let raf = 0;

    const smooth = (x: number) => {
        const c = Math.max(0, Math.min(1, x));
        return c * c * (3 - 2 * c);
    };

    const drawBubble = (x: number, y: number, r: number, hue: number, alpha: number) => paintBubble(ctx, x, y, r, hue, alpha);

    const stop = () => {
        cancelAnimationFrame(raf);
        canvas.remove();
        running = null;
    };
    running = stop;

    const frame = (now: number) => {
        const speed = window.PanelMotion ? window.PanelMotion.getSpeed() : 1;
        const t = ((now - start) / 1000) * speed;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        /* 彩虹：0.15 秒開始畫，0.9 秒畫完，停到 1.8 秒後淡出 */
        const arcP = smooth((t - 0.15) / 0.9);
        const arcAlpha = 0.34 * smooth((t - 0.15) / 0.3) * (1 - smooth((t - 1.8) / 0.8));
        if (arcP > 0 && arcAlpha > 0) {
            ctx.lineCap = 'round';
            ARC_HUES.forEach((hue, i) => {
                ctx.strokeStyle = `hsla(${hue}, 95%, 62%, ${arcAlpha})`;
                ctx.lineWidth = band;
                ctx.beginPath();
                ctx.arc(arcCx, arcCy, arcR - i * band, Math.PI, Math.PI + Math.PI * arcP);
                ctx.stroke();
            });
            ctx.lineCap = 'butt';
        }

        /* 稜鏡光：一道斜斜的彩色光帶從左上掃到右下（0.35 → 1.45 秒） */
        const sweep = (t - 0.35) / 1.1;
        if (sweep > 0 && sweep < 1) {
            const len = W + H;
            const pos = -260 + (len + 520) * smooth(sweep);
            const dx = 0.94;
            const dy = 0.34;
            const g = ctx.createLinearGradient(pos * dx - 130 * dx, pos * dy - 130 * dy, pos * dx + 130 * dx, pos * dy + 130 * dy);
            const a = 0.2 * Math.sin(Math.PI * sweep);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.2, `hsla(0,95%,65%,${a})`);
            g.addColorStop(0.36, `hsla(40,95%,60%,${a})`);
            g.addColorStop(0.5, `hsla(120,85%,60%,${a})`);
            g.addColorStop(0.64, `hsla(200,95%,62%,${a})`);
            g.addColorStop(0.8, `hsla(275,90%,66%,${a})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        }

        /* 星光：四角星，放大再縮小 */
        stars.forEach((st) => {
            const u = (t - st.delay) / st.life;
            if (u <= 0 || u >= 1) return;
            const k = Math.sin(Math.PI * u);
            const r = st.size * k;
            const hue = (st.x / W) * 300;
            ctx.fillStyle = `hsla(${hue}, 95%, 60%, ${0.9 * k})`;
            ctx.beginPath();
            ctx.moveTo(st.x, st.y - r);
            ctx.lineTo(st.x + r * 0.22, st.y - r * 0.22);
            ctx.lineTo(st.x + r, st.y);
            ctx.lineTo(st.x + r * 0.22, st.y + r * 0.22);
            ctx.lineTo(st.x, st.y + r);
            ctx.lineTo(st.x - r * 0.22, st.y + r * 0.22);
            ctx.lineTo(st.x - r, st.y);
            ctx.lineTo(st.x - r * 0.22, st.y - r * 0.22);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = `rgba(255,255,255,${0.95 * k})`;
            ctx.beginPath();
            ctx.arc(st.x, st.y, r * 0.18, 0, Math.PI * 2);
            ctx.fill();
        });

        sparks.forEach((s) => {
            const u = t - s.delay;
            if (u <= 0 || u >= s.life) return;
            /* 阻力 k：位置 = v(1 - e^(-ku))/k；重力往下拉 */
            const k = 2.4;
            const f = (1 - Math.exp(-k * u)) / k;
            const x = s.x + s.vx * f;
            const y = s.y + s.vy * f + 260 * u * u;
            const p = u / s.life;
            ctx.globalAlpha = (1 - p) * (1 - p);
            ctx.fillStyle = s.color;
            /* 對齊像素格，保持點陣感 */
            ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, s.size, s.size);
        });
        ctx.globalAlpha = 1;

        bubbles.forEach((b) => {
            const u = t - b.delay;
            if (u <= 0 || u >= b.life) return;
            const p = u / b.life;
            const x = b.x + Math.sin(b.phase + u * 2.6) * b.sway;
            const y = b.y - b.vy * u;
            const grow = Math.min(1, u / 0.25);
            if (p < 0.88) {
                drawBubble(x, y, b.r * (0.4 + 0.6 * grow), b.hue + u * 60, Math.min(1, u / 0.2));
            } else {
                /* 破掉：一圈往外擴散的細環，很快淡出 */
                paintPop(ctx, x, y, b.r, b.hue, (p - 0.88) / 0.12);
            }
        });

        if (t < end) raf = requestAnimationFrame(frame);
        else stop();
    };
    raf = requestAnimationFrame(frame);
};

/**
 * 按下時冒泡泡：彩虹世界裡按按鈕、連結、開關、核取方塊時，按下的地方冒出幾顆小泡泡，往上飄一小段後破掉。
 * - 只畫在按下位置附近一塊小畫布上（約 200 × 240），不是整個畫面，播完（約 1 秒）就移除
 * - 沒有一直在播放的動畫：不按就沒有任何成本，玻璃也不會因此每一幀重算折射
 * - 泡泡的大小、路徑依固定的順序產生，每個人看到的都一樣；跟著全域動畫速度，「減少動態效果」時不播
 */
const CLICK_TARGET = 'a[href], button, [role="button"], [role="switch"], [role="menuitem"], [role="menuitemcheckbox"], [role="tab"], input[type="checkbox"], input[type="radio"], label';
let clickSeq = 0;
let lastPuff = 0;

const puff = (cx: number, cy: number): void => {
    const now = performance.now();
    if (now - lastPuff < 120) return;
    lastPuff = now;
    const rnd = seeded(7919 * (++clickSeq % 16) + 17);
    const BW = 200;
    const BH = 240;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.className = 'sys-rainbow-puff';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = BW * dpr;
    canvas.height = BH * dpr;
    canvas.style.cssText = `position:fixed;left:${Math.round(cx - BW / 2)}px;top:${Math.round(cy - BH + 30)}px;width:${BW}px;height:${BH}px;pointer-events:none;z-index:2147482999;`;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        canvas.remove();
        return;
    }
    const n = 4 + Math.floor(rnd() * 2);
    const list = Array.from({ length: n }, (_, i) => ({
        x: BW / 2 + (rnd() - 0.5) * 36,
        r: 5 + rnd() * 9,
        vy: 110 + rnd() * 90,
        sway: 4 + rnd() * 8,
        phase: rnd() * Math.PI * 2,
        hue: (i * 360) / n + rnd() * 40,
        life: 0.75 + rnd() * 0.45,
        delay: i * 0.05,
    }));
    const end = Math.max(...list.map((b) => b.delay + b.life)) + 0.05;
    const start = now;
    const frame = (t0: number) => {
        const speed = window.PanelMotion ? window.PanelMotion.getSpeed() : 1;
        const t = ((t0 - start) / 1000) * speed;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, BW, BH);
        list.forEach((b) => {
            const u = t - b.delay;
            if (u <= 0 || u >= b.life) return;
            const p = u / b.life;
            const x = b.x + Math.sin(b.phase + u * 7) * b.sway;
            // 往上飄、越飄越慢
            const y = BH - 30 - b.vy * (u - 0.3 * u * u);
            if (p < 0.85) paintBubble(ctx, x, y, b.r * Math.min(1, 0.3 + u / 0.15), b.hue + u * 90, 1);
            else paintPop(ctx, x, y, b.r, b.hue, (p - 0.85) / 0.15);
        });
        if (t < end) requestAnimationFrame(frame);
        else canvas.remove();
    };
    requestAnimationFrame(frame);
};

let clicksReady = false;

/** 啟動按下冒泡泡（只註冊一次；只有淺色 + 彩虹時才會播） */
export const initRainbowClicks = (): void => {
    if (clicksReady || typeof document === 'undefined') return;
    clicksReady = true;
    document.addEventListener(
        'pointerdown',
        (e) => {
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
            if (!rainbowWorld() || reduced() || running) return;
            const target = e.target as Element | null;
            if (!target || !target.closest || !target.closest(CLICK_TARGET)) return;
            puff(e.clientX, e.clientY);
        },
        { capture: true, passive: true }
    );
};
