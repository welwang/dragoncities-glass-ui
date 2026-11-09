import type { HTMLAttributes } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

/** 卡片列：加上 sys-card（彩虹世界的珍珠色卡片，見 system-theme/appearance.css）；styled-components 會和傳入的 className 合併 */
export default styled.div.attrs({ className: 'sys-card sys-card-row' } as HTMLAttributes<HTMLDivElement>)<{ $hoverable?: boolean }>`
    ${tw`flex rounded-xl no-underline text-neutral-200 items-center bg-neutral-700 p-4 border border-transparent overflow-hidden`};
    transition: background-color 0.2s ease, transform 0.5s var(--lg-spring);

    ${(props) => props.$hoverable !== false && tw`hover:bg-neutral-600`};

    &:active {
        transform: ${(props) => (props.$hoverable !== false ? 'scale(0.985)' : 'none')};
    }

    & .icon {
        ${tw`rounded-xl w-16 flex items-center justify-center bg-neutral-600 p-3`};
    }
`;
