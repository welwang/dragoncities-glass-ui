import { useEffect, useState } from 'react';

/**
 * 深色 / 淺色模式。
 * - 沒有手動選過時跟隨作業系統（prefers-color-scheme）
 * - 手動切換後記在這個瀏覽器（localStorage），下次打開沿用
 * - 色盤本身在 GlobalStylesheet：<html data-theme="light"> 換成淺色變數
 */
export type ThemeMode = 'light' | 'dark';

const KEY = 'pterodactyl:theme';
const EVENT = 'sys-theme-change';

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

const stored = (): ThemeMode | null => {
    try {
        const value = window.localStorage.getItem(KEY);
        return value === 'light' || value === 'dark' ? value : null;
    } catch (e) {
        return null;
    }
};

const apply = (mode: ThemeMode): void => {
    document.documentElement.setAttribute('data-theme', mode);
    window.dispatchEvent(new CustomEvent<ThemeMode>(EVENT, { detail: mode }));
};

export const currentThemeMode = (): ThemeMode =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

/** 在畫面渲染前呼叫一次（index.tsx），避免先閃出另一種顏色 */
export const initThemeMode = (): void => {
    apply(stored() || (media && media.matches ? 'light' : 'dark'));

    const follow = (e: MediaQueryListEvent) => {
        if (!stored()) apply(e.matches ? 'light' : 'dark');
    };
    if (media && media.addEventListener) media.addEventListener('change', follow);
};

/** 切換模式；有傳入點擊位置時，新模式會從那個點以圓形展開 */
export const setThemeMode = (mode: ThemeMode, origin?: { x: number; y: number }): void => {
    try {
        window.localStorage.setItem(KEY, mode);
    } catch (e) {
        // 無痕模式等情況存不了，仍然切換本次的顯示
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = document as any;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof doc.startViewTransition !== 'function' || reduced) {
        apply(mode);
        return;
    }

    const x = origin ? origin.x : window.innerWidth / 2;
    const y = origin ? origin.y : 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = doc.startViewTransition(() => apply(mode));

    transition.ready
        .then(() => {
            const animation = document.documentElement.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: 560, easing: 'cubic-bezier(0.22, 0.8, 0.24, 1)', pseudoElement: '::view-transition-new(root)' }
            );
            window.PanelMotion.scale(animation);
        })
        .catch(() => undefined);
};

/** React：讀取目前模式並在切換時重新渲染 */
export const useThemeMode = (): [ThemeMode, typeof setThemeMode] => {
    const [mode, setMode] = useState<ThemeMode>(currentThemeMode);

    useEffect(() => {
        const listener = (e: Event) => setMode((e as CustomEvent<ThemeMode>).detail);
        window.addEventListener(EVENT, listener);
        return () => window.removeEventListener(EVENT, listener);
    }, []);

    return [mode, setThemeMode];
};
