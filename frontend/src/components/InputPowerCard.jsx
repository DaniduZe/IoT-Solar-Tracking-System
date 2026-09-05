import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import { Zap } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const InputPowerCard = () => {
    const { latestData } = useTelemetry();
    
    const v = latestData?.measurements?.in_v || 0;
    const a = latestData?.measurements?.in_a || 0;
    const w = v * a;

    return (
        <TelemetryCard title="Input Power (Solar)" icon={<Zap size={20} className="text-brand-yellow" />}>
            <div className="flex flex-col">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2 font-mono">
                    {w.toFixed(2)} <span className="text-lg md:text-xl text-brand-yellow">W</span>
                </div>
                <div className="flex justify-between text-slate-400 text-sm font-mono">
                    <span>{v.toFixed(2)} V</span>
                    <span>{a.toFixed(3)} A</span>
                </div>
            </div>
        </TelemetryCard>
    );
};
