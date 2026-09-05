import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import { Sun } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const RawSolarCard = () => {
    const { latestData } = useTelemetry();
    const v = latestData?.measurements?.in_v || 0;
    const a = latestData?.measurements?.in_a || 0;

    return (
        <TelemetryCard title="Raw Solar Input" icon={<Sun size={20} className="text-brand-yellow" />}>
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline border-b border-slate-700/50 pb-2">
                    <span className="text-slate-400 font-mono text-sm">Voltage (V)</span>
                    <span className="text-2xl font-bold text-white font-mono">{v.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-slate-400 font-mono text-sm">Current (A)</span>
                    <span className="text-2xl font-bold text-white font-mono">{a.toFixed(3)}</span>
                </div>
            </div>
        </TelemetryCard>
    );
};
