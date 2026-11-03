import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCogs, faLayerGroup, faMoon, faSignOutAlt, faSun } from '@fortawesome/free-solid-svg-icons';
import { useThemeMode } from '@/system-theme/theme-mode';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import SearchContainer from '@/components/dashboard/search/SearchContainer';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import http from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Avatar from '@/components/Avatar';
import AnimationSpeedControl from '@/components/AnimationSpeedControl';
import { panelBrand } from '@/system-theme/panel-brand';

// 導覽列是玻璃控制層（sys-bar）；連結是圓形圖示按鈕，選取狀態用膠囊而不是底線
const RightNavigation = styled.div`
    & > a,
    & > button,
    & > .navigation-link {
        ${tw`flex items-center justify-center flex-none h-11 w-11 rounded-full no-underline text-neutral-200 cursor-pointer`};
        font-size: 1.0625rem;
        transition: background-color 0.25s ease, color 0.25s ease, transform 0.5s var(--lg-spring);

        /* 手機：圖示縮小一點，名稱才不會被擠掉 */
        @media (max-width: 639px) {
            width: 2rem;
            height: 2.375rem;
        }

        &:hover {
            ${tw`text-neutral-50`};
            background-color: var(--sys-hover);
        }

        &.active {
            ${tw`text-neutral-50`};
            background-color: var(--sys-select);
        }

        &:active {
            transform: scale(0.92);
        }
    }

    /* 手機：左邊的面板名稱本身就會回到伺服器列表，省掉重複的 Dashboard 圖示 */
    @media (max-width: 639px) {
        & > a.nav-dashboard {
            display: none;
        }
    }
`;

interface Props {
    children?: React.ReactNode;
    server?: { name: string; node: string; status: string | null };
}

export default ({ children, server }: Props) => {
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);
    const previousTabs = useRef(children);
    useEffect(() => { if (children) previousTabs.current = children; }, [children]);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [mode, setMode] = useThemeMode();
    const nextMode = mode === 'dark' ? 'light' : 'dark';

    const onTriggerLogout = () => {
        setIsLoggingOut(true);
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error this is valid
            window.location = '/';
        });
    };

    return (
        <div className={'unified-navigation'}>
            <SpinnerOverlay visible={isLoggingOut} />
            <div
                className={'lg sys-nav-shell'}
                data-glass
            >
                <div className={'sys-bar sys-nav-row sys-nav-top'}>
                <div id={'logo'} className={'panel-brand'}>
                    <Link
                        to={'/'}
                        className={'brand-mark'}
                        aria-label={panelBrand.name}
                    >
                        <img
                            src={panelBrand.logo}
                            alt={''}
                            className={'brand-image'}
                        />
                    </Link>
                    <div className={'brand-copy'}>
                        <div className={'brand-heading'}>
                            <Link to={'/'} className={'brand-wordmark'}>{panelBrand.name}</Link>
                            <AnimationSpeedControl />
                        </div>
                        <div className={'server-caption'} title={server ? `${server.name} · ${server.status || 'Connecting'} · ${server.node}` : '伺服器面板'}>
                            {server ? <>
                                <span className={`server-status-dot status-${server.status || 'connecting'}`} />
                                <span>{server.name} · {server.status ? server.status.replace(/_/g, ' ') : 'Connecting'} · {server.node}</span>
                            </> : <span>伺服器面板</span>}
                        </div>
                    </div>
                </div>
                <RightNavigation className={'flex h-full items-center justify-center gap-0.5'}>
                    <SearchContainer />
                    <Tooltip placement={'bottom'} content={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                        <button
                            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            onClick={(e) => setMode(nextMode, { x: e.clientX, y: e.clientY })}
                        >
                            <FontAwesomeIcon key={mode} icon={mode === 'dark' ? faSun : faMoon} className={'sys-swap'} />
                        </button>
                    </Tooltip>
                    <Tooltip placement={'bottom'} content={'Dashboard'}>
                        <NavLink to={'/'} exact className={'nav-dashboard'}>
                            <FontAwesomeIcon icon={faLayerGroup} />
                        </NavLink>
                    </Tooltip>
                    {rootAdmin && (
                        <Tooltip placement={'bottom'} content={'Admin'}>
                            <a href={'/admin'} rel={'noreferrer'}>
                                <FontAwesomeIcon icon={faCogs} />
                            </a>
                        </Tooltip>
                    )}
                    <Tooltip placement={'bottom'} content={'Account Settings'}>
                        <NavLink to={'/account'}>
                            <span className={'flex items-center w-5 h-5'}>
                                <Avatar.User />
                            </span>
                        </NavLink>
                    </Tooltip>
                    <Tooltip placement={'bottom'} content={'Sign Out'}>
                        <button onClick={onTriggerLogout}>
                            <FontAwesomeIcon icon={faSignOutAlt} />
                        </button>
                    </Tooltip>
                </RightNavigation>
                </div>
                <div
                    className={'nav-tabs-slot'}
                    data-expanded={!!children}
                    aria-hidden={!children}
                    {...(!children ? { inert: '' } : {})}
                >
                    <div className={'nav-tabs-clip'}>{children || previousTabs.current}</div>
                </div>
            </div>
        </div>
    );
};
