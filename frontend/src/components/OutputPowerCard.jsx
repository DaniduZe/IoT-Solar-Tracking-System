import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import { PlugZap } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const OutputPowerCard = () => {
    const { latestData } = useTelemetry();
    
    const v = latestData?.measurements?.out_v || 0;
    const a = latestData?.measurements?.out_a || 0;
    const w = v * a;

    return (
        <TelemetryCard title="Output Power (Load)" icon={<PlugZap size={20} className="text-brand-green" />}>
            <div className="flex flex-col">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2 font-mono">
                    {w.toFixed(2)} <span className="text-lg md:text-xl text-brand-green">W</span>
                </div>
                <div className="flex justify-between text-slate-400 text-sm font-mono">
                    <span>{v.toFixed(2)} V</span>
                    <span>{a.toFixed(3)} A</span>
                </div>
            </div>
        </TelemetryCard>
    );
};
