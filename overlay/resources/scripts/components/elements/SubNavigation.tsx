import type { HTMLAttributes } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * 分頁列：玻璃控制層（sys-bar），浮在內容上方並在捲動時停在導覽列下面。
 * 選取的分頁是一顆膠囊；外觀規則見 system-theme/roles.css。
 */
// 用 HTMLAttributes 標註型別：children 仍是一般的 ReactNode（字串索引寫法會讓 tsc 報 TS2769）
const SubNavigation = styled.div.attrs({ className: 'sys-bar sys-nav-row sys-nav-tabs' } as HTMLAttributes<HTMLDivElement>)`
    width: 100%;
    margin: 0;

    /* 玻璃外框不捲動也不裁切；裡面這層負責左右滑動。
       捲到邊緣時用漸隱遮罩（liquid-glass.js 設定 data-lg-scroll），文字不會被圓角硬切掉 */
    & > div {
        ${tw`flex items-center text-sm p-1.5 gap-1`};
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }

        & > a,
        & > div {
            ${tw`inline-flex flex-none items-center h-10 px-4 rounded-full font-medium text-neutral-300 no-underline whitespace-nowrap`};
            transition: background-color 0.25s ease, color 0.25s ease, transform 0.5s var(--lg-spring);

            &:hover {
                ${tw`text-neutral-50`};
                background-color: var(--sys-hover);
            }

            &:active {
                transform: scale(0.95);
            }

            &.active {
                ${tw`text-neutral-50`};
                background-color: var(--sys-select);
            }
        }
    }
`;

export default SubNavigation;
