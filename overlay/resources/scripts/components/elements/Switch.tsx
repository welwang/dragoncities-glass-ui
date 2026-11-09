import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import { v4 } from 'uuid';
import tw from 'twin.macro';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';
import PixelIcon, { useEdgeGlow } from '@/components/elements/PixelIcon';

/**
 * 開關（系統主題）：凹陷的軌道 + 玻璃方塊圓鈕。
 * 圓鈕上是點陣圖示：開 = ✓、關 = ○，切換時像素散開再重組；開啟時圓鈕邊緣有一道跟著游標的光
 * （淺色模式暖橘、深色模式藍紫）。外觀規則在 system-theme/appearance.css（.sys-sw）。
 */
const ToggleContainer = styled.div`
    ${tw`relative select-none leading-normal`};
    width: 54px;

    & > input[type='checkbox'] {
        ${tw`hidden`};

        &:disabled + label {
            ${tw`opacity-50 cursor-not-allowed`};
        }
    }

    & > label {
        ${tw`mb-0 block cursor-pointer`};
    }
`;

export interface SwitchProps {
    name: string;
    label?: string;
    description?: string;
    defaultChecked?: boolean;
    readOnly?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    children?: React.ReactNode;
}

const Switch = ({ name, label, description, defaultChecked, readOnly, onChange, children }: SwitchProps) => {
    const uuid = useMemo(() => v4(), []);
    const box = useRef<HTMLDivElement>(null);
    const knob = useRef<HTMLSpanElement>(null);
    const [on, setOn] = useState(!!defaultChecked);
    useEdgeGlow(knob, 90, 'self', 160);

    // 開關的狀態以實際的 checkbox 為準（也支援父層用 children 傳入自己的 input、或由表單改值）
    useLayoutEffect(() => {
        const input = box.current?.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (input && input.checked !== on) setOn(input.checked);
    });

    return (
        <div css={tw`flex items-center`}>
            <ToggleContainer
                ref={box}
                css={tw`flex-none`}
                className={'sys-sw'}
                data-on={on ? '' : undefined}
                onChangeCapture={(e: React.FormEvent<HTMLDivElement>) => {
                    const input = e.target as HTMLInputElement;
                    if (input.type === 'checkbox') setOn(input.checked);
                }}
            >
                {children || (
                    <Input
                        id={uuid}
                        name={name}
                        type={'checkbox'}
                        onChange={(e) => onChange && onChange(e)}
                        defaultChecked={defaultChecked}
                        disabled={readOnly}
                    />
                )}
                <Label htmlFor={uuid} className={'sys-sw-track'}>
                    <span ref={knob} className={'sys-sw-knob sys-edge-glow'}>
                        <PixelIcon icon={on ? 'check' : 'ring'} size={16} />
                    </span>
                </Label>
            </ToggleContainer>
            {(label || description) && (
                <div css={tw`ml-4 w-full`}>
                    {label && (
                        <Label css={[tw`cursor-pointer`, !!description && tw`mb-0`]} htmlFor={uuid}>
                            {label}
                        </Label>
                    )}
                    {description && <p css={tw`text-neutral-400 text-sm mt-2`}>{description}</p>}
                </div>
            )}
        </div>
    );
};

export default Switch;
