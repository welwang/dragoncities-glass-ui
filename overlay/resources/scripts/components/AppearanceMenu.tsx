import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import PixelIcon, { useEdgeGlow } from '@/components/elements/PixelIcon';
import { Appearance, rainbowActive, setThemeAccent, setThemePreference, useAppearance } from '@/system-theme/theme-mode';

/**
 * 導覽列的外觀控制：
 * - 深淺色開關：凹陷的軌道 + 玻璃方塊圓鈕；圖示是點陣的太陽／月亮，切換時像素散開再重組成另一個圖示；
 *   圓鈕邊緣有一道跟著游標移動的光（淺色是暖橘、深色是藍紫）
 * - 旁邊的 ▾ 打開「外觀」選單：跟隨系統、彩虹（淺色模式的泡泡玻璃）
 * 選單畫在頁面最上層（portal），不會被導覽列的玻璃裁切；外觀規則在 system-theme/appearance.css
 */

/* ---------- 深淺色開關 ---------- */
// 沒有游標在附近時，光停在右上（淺色）／左下（深色）
const REST_ANGLE = { light: 45, dark: 225 };

const ThemeToggle = ({ appearance }: { appearance: Appearance }) => {
    const knob = useRef<HTMLSpanElement>(null);
    const mode = appearance.mode;
    useEdgeGlow(knob, REST_ANGLE[mode], 'window');

    return (
        <button
            type={'button'}
            role={'switch'}
            aria-checked={mode === 'dark'}
            aria-label={'深色模式'}
            className={'sys-tt-switch'}
            data-mode={mode}
            onClick={(e) =>
                setThemePreference(
                    mode === 'dark' ? 'light' : 'dark',
                    e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : undefined
                )
            }
        >
            <span ref={knob} className={'sys-tt-knob sys-edge-glow'}>
                <PixelIcon icon={mode === 'light' ? 'sun' : 'moon'} />
            </span>
        </button>
    );
};

/* ---------- 外觀選單 ---------- */
const AppearanceMenu = () => {
    const appearance = useAppearance();
    const { mode, preference } = appearance;
    const [open, setOpen] = useState(false);
    const [at, setAt] = useState({ top: 0, right: 0 });
    // ▾ 按鈕在點擊時記下來：Tooltip 會用自己的 ref 包住按鈕（cloneElement），不能用 ref 屬性拿到它
    const button = useRef<HTMLButtonElement | null>(null);
    const menu = useRef<HTMLDivElement>(null);
    const rainbow = rainbowActive(appearance);
    const system = preference === 'system';

    useLayoutEffect(() => {
        if (!open || !button.current) return;
        const r = button.current.getBoundingClientRect();
        setAt({ top: r.bottom + 10, right: Math.max(8, window.innerWidth - r.right - 6) });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = (e: Event) => {
            if (e instanceof KeyboardEvent) {
                if (e.key !== 'Escape') return;
                setOpen(false);
                button.current?.focus();
                return;
            }
            const t = e.target as Node;
            if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
        };
        document.addEventListener('pointerdown', close, true);
        document.addEventListener('keydown', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('pointerdown', close, true);
            document.removeEventListener('keydown', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    // 打開時把焦點放到第一個項目（鍵盤可直接上下選）
    useEffect(() => {
        if (open) menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
    }, [open]);

    const onMenuKey = (e: React.KeyboardEvent) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') || []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
        next?.focus();
    };

    const point = (e: React.MouseEvent) => (e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : undefined);

    return (
        <div className={'sys-tt'}>
            <ThemeToggle appearance={appearance} />
            <Tooltip placement={'bottom'} content={'外觀選項'} disabled={open}>
                <button
                    type={'button'}
                    className={'sys-tt-more'}
                    aria-label={'外觀選項'}
                    aria-haspopup={'menu'}
                    aria-expanded={open}
                    onClick={(e) => {
                        button.current = e.currentTarget;
                        setOpen((v) => !v);
                    }}
                >
                    <FontAwesomeIcon icon={faChevronDown} />
                </button>
            </Tooltip>
            {createPortal(
                <div
                    ref={menu}
                    className={'lg sys-menu sys-appearance'}
                    data-glass
                    data-open={open ? '' : undefined}
                    role={'menu'}
                    aria-label={'外觀'}
                    aria-hidden={!open}
                    style={{ top: at.top, right: at.right }}
                    onKeyDown={onMenuKey}
                >
                    <div className={'sys-appearance-title'}>外觀</div>
                    <button
                        type={'button'}
                        role={'menuitemcheckbox'}
                        aria-checked={system}
                        tabIndex={open ? 0 : -1}
                        className={'sys-appearance-item'}
                        onClick={(e) => setThemePreference(system ? mode : 'system', point(e))}
                    >
                        <span className={'sys-system-glyph'} aria-hidden />
                        <span>跟隨系統</span>
                        <span className={'sys-mini-switch'} data-on={system ? '' : undefined} aria-hidden />
                    </button>
                    <button
                        type={'button'}
                        role={'menuitemcheckbox'}
                        aria-checked={rainbow}
                        tabIndex={open ? 0 : -1}
                        className={'sys-appearance-item'}
                        onClick={(e) => setThemeAccent(rainbow ? 'default' : 'rainbow', point(e))}
                    >
                        <span className={'sys-rainbow-glyph'} aria-hidden />
                        <span>彩虹</span>
                        <span className={'sys-appearance-note'}>淺色模式</span>
                        <span className={'sys-mini-switch'} data-on={rainbow ? '' : undefined} aria-hidden />
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

export default AppearanceMenu;
