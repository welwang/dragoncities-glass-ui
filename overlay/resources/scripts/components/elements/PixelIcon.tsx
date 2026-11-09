import React, { useEffect, useRef } from 'react';

/**
 * 點陣圖示與邊緣光（系統主題共用）
 *
 * PixelIcon：13 × 13 格的點陣圖示。icon 改變時，像素散開成光點、沿弧線飛到新位置重組成另一個圖示；
 *            多出來的像素淡入／淡出。時間跟著全域動畫速度（PanelMotion），系統「減少動態效果」時直接換圖。
 * useEdgeGlow：在元素上寫入 --tt-a（角度）、--tt-bx / --tt-by（邊緣上的位置），
 *            讓 CSS（system-theme/appearance.css 的 .sys-edge-glow）畫出跟著游標移動的邊緣光。
 */
export type PixelIconName = 'sun' | 'moon' | 'check' | 'ring' | 'eye' | 'eyeOff';

type Dot = [number, number];
const GRID = 13;

const raster = (inside: (x: number, y: number) => boolean): Dot[] => {
    const dots: Dot[] = [];
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (inside(x, y)) dots.push([x, y]);
    return dots;
};

/** 點到線段的距離（畫線條用） */
const seg = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax,
        dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
};

const eyeShape = (x: number, y: number) => {
    // 杏仁形外框：上下兩條弧線之間的細邊 + 中間的瞳孔
    const half = 4.2 * Math.sqrt(Math.max(0, 1 - ((x - 6) / 6.2) ** 2));
    const d = Math.abs(y - 6);
    const outline = Math.abs(d - half) < 0.75 && Math.abs(x - 6) <= 6;
    const pupil = (x - 6) ** 2 + (y - 6) ** 2 <= 1.9 ** 2;
    return outline || pupil;
};

const ICONS: Record<PixelIconName, Dot[]> = {
    sun: [
        ...raster((x, y) => (x - 6) ** 2 + (y - 6) ** 2 <= 2.6 ** 2),
        // 光芒：上下左右各兩格，四個斜角各一格
        [6, 0],
        [6, 1],
        [6, 11],
        [6, 12],
        [0, 6],
        [1, 6],
        [11, 6],
        [12, 6],
        [2, 2],
        [10, 2],
        [2, 10],
        [10, 10],
    ],
    moon: [
        ...raster((x, y) => (x - 5.6) ** 2 + (y - 6.8) ** 2 <= 4.7 ** 2 && (x - 8.4) ** 2 + (y - 4.4) ** 2 > 4.1 ** 2),
        // 右上角兩顆小星星
        [10, 0],
        [9, 1],
        [10, 1],
        [11, 1],
        [10, 2],
        [12, 4],
    ],
    check: raster((x, y) => seg(x, y, 2.5, 6.8, 5.2, 9.5) < 0.8 || seg(x, y, 5.2, 9.5, 10.5, 3.2) < 0.8),
    ring: raster((x, y) => Math.abs(Math.hypot(x - 6, y - 6) - 3.6) < 0.7),
    eye: raster(eyeShape),
    eyeOff: raster((x, y) => {
        const slash = seg(x, y, 1.5, 1.5, 11.5, 11.5);
        return slash < 0.7 || (eyeShape(x, y) && slash > 1.6);
    }),
};

interface Particle {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    cx: number;
    cy: number;
    a0: number;
    a1: number;
    delay: number;
}

const shuffle = <T,>(list: T[]): T[] => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const reducedMotion = (): boolean =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface PixelIconProps {
    icon: PixelIconName;
    /** 顯示大小（CSS px），預設 21 */
    size?: number;
    className?: string;
}

const PixelIcon = ({ icon, size = 21, className }: PixelIconProps) => {
    const canvas = useRef<HTMLCanvasElement>(null);
    const shown = useRef<Dot[] | null>(null);
    // 目前的靜止畫面：深淺色切換後用新顏色重畫（圖示只在形狀改變時才會自己重畫）
    const redraw = useRef<(() => void) | null>(null);
    const animating = useRef(false);

    useEffect(() => {
        // 切換深淺色時，圖示的顏色通常有 CSS 轉場（會跟著全域動畫速度變慢），
        // 所以在轉場期間每一幀都用目前的顏色重畫，直到顏色穩定
        let raf = 0;
        let until = 0;
        const loop = (now: number) => {
            raf = 0;
            if (!animating.current && redraw.current) redraw.current();
            if (now < until) raf = requestAnimationFrame(loop);
        };
        const onTheme = () => {
            const speed = window.PanelMotion ? window.PanelMotion.getSpeed() : 1;
            until = performance.now() + 900 / Math.max(0.1, speed);
            if (!raf) raf = requestAnimationFrame(loop);
        };
        window.addEventListener('sys-theme-change', onTheme);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('sys-theme-change', onTheme);
        };
    }, []);

    useEffect(() => {
        const el = canvas.current;
        if (!el) return;
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        el.width = Math.round(size * dpr);
        el.height = Math.round(size * dpr);
        const ctx = el.getContext('2d');
        if (!ctx) return;

        const cell = size / GRID;
        const dot = cell * 0.78;
        const draw = (points: { x: number; y: number; a: number }[]) => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, size, size);
            // 顏色跟著 CSS 的 color（切換深淺色的過程中也會跟著變）
            ctx.fillStyle = getComputedStyle(el).color;
            points.forEach((p) => {
                if (p.a <= 0) return;
                ctx.globalAlpha = Math.min(1, p.a);
                ctx.fillRect(p.x * cell + (cell - dot) / 2, p.y * cell + (cell - dot) / 2, dot, dot);
            });
            ctx.globalAlpha = 1;
        };

        const target = ICONS[icon];
        const from = shown.current;
        shown.current = target;
        const still = () => draw(target.map(([x, y]) => ({ x, y, a: 1 })));
        redraw.current = still;
        if (!from || from === target || reducedMotion()) {
            animating.current = false;
            still();
            return;
        }

        // 配對：多出來的像素從舊圖示裡長出來（淡入），或飛向新圖示時淡出
        const a = shuffle(from);
        const b = shuffle(target);
        const n = Math.max(a.length, b.length);
        const particles: Particle[] = [];
        for (let i = 0; i < n; i++) {
            const s = a[i % a.length];
            const e = b[i % b.length];
            const mx = (s[0] + e[0]) / 2;
            const my = (s[1] + e[1]) / 2;
            // 散開：中點往外推一點再加上隨機偏移
            particles.push({
                x0: s[0],
                y0: s[1],
                x1: e[0],
                y1: e[1],
                cx: mx + (mx - 6) * 0.45 + (Math.random() - 0.5) * 7,
                cy: my + (my - 6) * 0.45 + (Math.random() - 0.5) * 7,
                a0: i < a.length ? 1 : 0,
                a1: i < b.length ? 1 : 0,
                delay: Math.random() * 0.28,
            });
        }

        const speed = window.PanelMotion ? window.PanelMotion.getSpeed() : 1;
        const duration = 720 / Math.max(0.1, speed);
        const start = performance.now();
        animating.current = true;
        let raf = 0;
        const frame = (now: number) => {
            const raw = Math.min(1, (now - start) / duration);
            draw(
                particles.map((p) => {
                    const t = ease(Math.max(0, Math.min(1, (raw - p.delay) / (1 - p.delay))));
                    const u = 1 - t;
                    return {
                        x: u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1,
                        y: u * u * p.y0 + 2 * u * t * p.cy + t * t * p.y1,
                        // 飛行中稍微變淡，像散開的光點
                        a: (p.a0 + (p.a1 - p.a0) * t) * (1 - 0.35 * Math.sin(Math.PI * t)),
                    };
                })
            );
            if (raw < 1) raf = requestAnimationFrame(frame);
            else {
                animating.current = false;
                still();
            }
        };
        raf = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(raf);
            animating.current = false;
        };
    }, [icon, size]);

    return (
        <canvas
            ref={canvas}
            className={className ? `sys-pixel-icon ${className}` : 'sys-pixel-icon'}
            style={{ width: size, height: size }}
            aria-hidden
        />
    );
};

/**
 * 邊緣光跟著游標：算出游標相對元素中心的角度（0° = 正上方，順時針），連續累加避免繞圈時跳一圈。
 * - scope = 'window'：整個頁面的游標都追（導覽列的深淺色開關，游標接近時光就轉過去）
 * - scope = 'self'：只有游標在元素上（或附近的父層）時才追（表單裡很多開關時比較省）
 * 游標離開或距離超過 radius 時，光回到 restAngle。
 */
export const useEdgeGlow = (
    ref: React.RefObject<HTMLElement>,
    restAngle: number,
    scope: 'window' | 'self' = 'self',
    radius = 280
) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let raf = 0;
        let last: { x: number; y: number } | null = null;
        let angle: number | null = null;
        const apply = () => {
            raf = 0;
            const r = el.getBoundingClientRect();
            const dx = last ? last.x - (r.left + r.width / 2) : 0;
            const dy = last ? last.y - (r.top + r.height / 2) : 0;
            const near = last && Math.hypot(dx, dy) < radius;
            const target = near ? (Math.atan2(dx, -dy) * 180) / Math.PI : restAngle;
            angle = angle === null ? target : angle + ((((target - angle) % 360) + 540) % 360) - 180;
            const rad = (angle * Math.PI) / 180;
            el.style.setProperty('--tt-a', `${angle.toFixed(1)}deg`);
            el.style.setProperty('--tt-bx', `${(50 + 50 * Math.sin(rad)).toFixed(1)}%`);
            el.style.setProperty('--tt-by', `${(50 - 50 * Math.cos(rad)).toFixed(1)}%`);
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(apply);
        };
        const onMove = (e: PointerEvent) => {
            last = { x: e.clientX, y: e.clientY };
            schedule();
        };
        const onLeave = () => {
            last = null;
            schedule();
        };
        apply();
        if (reducedMotion()) return;
        const host = scope === 'window' ? window : el.parentElement || el;
        const leaveHost = scope === 'window' ? document.documentElement : el.parentElement || el;
        host.addEventListener('pointermove', onMove as EventListener, { passive: true });
        leaveHost.addEventListener('pointerleave', onLeave);
        return () => {
            cancelAnimationFrame(raf);
            host.removeEventListener('pointermove', onMove as EventListener);
            leaveHost.removeEventListener('pointerleave', onLeave);
        };
    }, [restAngle, scope, radius]);
};

export default PixelIcon;
