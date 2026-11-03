import { useEffect, useState } from 'react';

declare global {
    interface Window {
        PanelMotion: {
            getSpeed(): number;
            setSpeed(speed: number): void;
            scale(animation: Animation): void;
        };
    }
}

export const currentAnimationSpeed = (): number => window.PanelMotion.getSpeed();
export const motionDuration = (milliseconds: number): number => milliseconds / currentAnimationSpeed();

export const useAnimationSpeed = (): [number, (speed: number) => void] => {
    const [speed, setSpeed] = useState(currentAnimationSpeed);
    useEffect(() => {
        const changed = () => setSpeed(currentAnimationSpeed());
        window.addEventListener('panel-motion-speed-change', changed);
        return () => window.removeEventListener('panel-motion-speed-change', changed);
    }, []);
    return [speed, window.PanelMotion.setSpeed];
};
