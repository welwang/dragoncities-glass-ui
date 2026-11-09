import { useEffect, useState } from 'react';

/**
 * 外觀：深色 / 淺色 / 跟隨系統，以及彩虹強調色。
 * - 模式：沒有手動選過（或選了「自動」）時跟隨作業系統（prefers-color-scheme）
 * - 彩虹：淺色模式專用，<html data-accent="rainbow">；深色模式時設定保留但不生效，切回淺色就恢復。
 *   外觀規則在 system-theme/appearance.css（全部以 [data-theme='light'][data-accent='rainbow'] 開頭）
 * - 選擇記在這個瀏覽器（localStorage），下次打開沿用
 * - 色盤本身在 GlobalStylesheet：<html data-theme="light"> 換成淺色變數
 */
export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';
export type ThemeAccent = 'default' | 'rainbow';

export interface Appearance {
    mode: ThemeMode;
    preference: ThemePreference;
    accent: ThemeAccent;
}

const KEY = 'pterodactyl:theme';
const ACCENT_KEY = 'pterodactyl:accent';
/** 舊事件：detail 是目前的模式字串（保留給既有程式） */
const EVENT = 'sys-theme-change';
/** 新事件：detail 是完整的 Appearance */
const APPEARANCE_EVENT = 'sys-appearance-change';

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

const read = (key: string): string | null => {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        return null;
    }
};

const write = (key: string, value: string | null): void => {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch (e) {
        // 無痕模式等情況存不了，仍然切換本次的顯示
    }
};

const storedPreference = (): ThemePreference => {
    const value = read(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
};

const storedAccent = (): ThemeAccent => (read(ACCENT_KEY) === 'rainbow' ? 'rainbow' : 'default');

const resolve = (preference: ThemePreference): ThemeMode =>
    preference === 'system' ? (media && media.matches ? 'light' : 'dark') : preference;

export const currentThemeMode = (): ThemeMode =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

export const currentAppearance = (): Appearance => ({
    mode: currentThemeMode(),
    preference: storedPreference(),
    accent: document.documentElement.getAttribute('data-accent') === 'rainbow' ? 'rainbow' : 'default',
});

const apply = (preference: ThemePreference, accent: ThemeAccent): void => {
    const root = document.documentElement;
    const mode = resolve(preference);
    root.setAttribute('data-theme', mode);
    if (accent === 'rainbow') root.setAttribute('data-accent', 'rainbow');
    else root.removeAttribute('data-accent');

    window.dispatchEvent(new CustomEvent<ThemeMode>(EVENT, { detail: mode }));
    window.dispatchEvent(new CustomEvent<Appearance>(APPEARANCE_EVENT, { detail: { mode, preference, accent } }));
};

/**
 * 換外觀時，新外觀從點擊位置以圓形展開（View Transition）。
 * 動畫長度跟著全域動畫速度（PanelMotion）；不支援或「減少動態效果」時直接切換。
 */
const reveal = (change: () => void, origin?: { x: number; y: number }): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = document as any;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof doc.startViewTransition !== 'function' || reduced) {
        change();
        return;
    }

    const x = origin ? origin.x : window.innerWidth / 2;
    const y = origin ? origin.y : 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = doc.startViewTransition(change);

    transition.ready
        .then(() => {
            const animation = document.documentElement.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: 560, easing: 'cubic-bezier(0.22, 0.8, 0.24, 1)', pseudoElement: '::view-transition-new(root)' }
            );
            if (window.PanelMotion) window.PanelMotion.scale(animation);
        })
        .catch(() => undefined);
};

/** 在畫面渲染前呼叫一次（index.tsx），避免先閃出另一種顏色 */
export const initThemeMode = (): void => {
    apply(storedPreference(), storedAccent());

    const follow = () => {
        if (storedPreference() === 'system') apply('system', storedAccent());
    };
    if (media && media.addEventListener) media.addEventListener('change', follow);

    // 其他分頁改了外觀時同步
    window.addEventListener('storage', (e) => {
        if (e.key === KEY || e.key === ACCENT_KEY || e.key === null) apply(storedPreference(), storedAccent());
    });
};

/** 選擇深色 / 淺色 / 自動；畫面真的換色時才播放圓形展開 */
export const setThemePreference = (preference: ThemePreference, origin?: { x: number; y: number }): void => {
    write(KEY, preference === 'system' ? null : preference);
    const accent = storedAccent();
    if (resolve(preference) === currentThemeMode()) {
        apply(preference, accent);
        return;
    }
    reveal(() => apply(preference, accent), origin);
};

/** 舊介面：直接指定深色或淺色 */
export const setThemeMode = (mode: ThemeMode, origin?: { x: number; y: number }): void =>
    setThemePreference(mode, origin);

/** 開關彩虹（淺色模式專用）：在深色模式打開彩虹時，會一起切到淺色 */
export const setThemeAccent = (accent: ThemeAccent, origin?: { x: number; y: number }): void => {
    write(ACCENT_KEY, accent === 'rainbow' ? 'rainbow' : null);
    let preference = storedPreference();
    if (accent === 'rainbow' && resolve(preference) === 'dark') {
        preference = 'light';
        write(KEY, 'light');
    }
    reveal(() => apply(preference, accent), origin);
};

/** 彩虹是否正在生效（有開啟而且目前是淺色模式） */
export const rainbowActive = (appearance: Appearance): boolean =>
    appearance.accent === 'rainbow' && appearance.mode === 'light';

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

/** React：完整的外觀狀態（模式、偏好、強調色） */
export const useAppearance = (): Appearance => {
    const [appearance, setAppearance] = useState<Appearance>(currentAppearance);

    useEffect(() => {
        const listener = (e: Event) => setAppearance((e as CustomEvent<Appearance>).detail);
        window.addEventListener(APPEARANCE_EVENT, listener);
        setAppearance(currentAppearance());
        return () => window.removeEventListener(APPEARANCE_EVENT, listener);
    }, []);

    return appearance;
};
