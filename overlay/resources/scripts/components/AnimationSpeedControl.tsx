import React from 'react';
import { useAnimationSpeed } from '@/system-theme/animation-speed';

export default () => {
    const [speed, setSpeed] = useAnimationSpeed();
    const value = `${speed.toFixed(2).replace(/0$/, '')}×`;
    return (
        <label className={'motion-speed-control'} title={`全局動畫速度 ${value}`}>
            <span className={'sr-only'}>全局動畫速度</span>
            <input
                type={'range'}
                min={0.25}
                max={1.5}
                step={0.05}
                value={speed}
                aria-label={'全局動畫速度'}
                aria-valuetext={value}
                onChange={(event) => setSpeed(Number(event.currentTarget.value))}
            />
            <output>{value}</output>
        </label>
    );
};
