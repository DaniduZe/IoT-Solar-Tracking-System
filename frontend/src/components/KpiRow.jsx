import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';

export const KpiRow = () => {
    const { latestData } = useTelemetry();
    
    const inW = (latestData?.measurements?.in_v || 0) * (latestData?.measurements?.in_a || 0);
    const outW = (latestData?.measurements?.out_v || 0) * (latestData?.measurements?.out_a || 0);
    const efficiency = inW > 0 ? (outW / inW) * 100 : 0;
    const boundedEff = Math.min(Math.max(efficiency, 0), 100);

    return (
        <div className="grid grid-cols-3 gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/50 shadow-xl rounded-2xl p-4 md:p-6">
            <div className="flex flex-col items-center justify-center border-r border-slate-800/50">
                <span className="text-xs text-slate-400 uppercase mb-1">Solar Power</span>
                <div className="text-2xl font-bold text-brand-yellow font-mono">{inW.toFixed(2)} W</div>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-slate-800/50">
                <span className="text-xs text-slate-400 uppercase mb-1">Load Power</span>
                <div className="text-2xl font-bold text-brand-green font-mono">{outW.toFixed(2)} W</div>
            </div>
            <div className="flex flex-col items-center justify-center">
                <span className="text-xs text-slate-400 uppercase mb-1">Efficiency (η)</span>
                <div className="text-2xl font-bold text-brand-blue font-mono">{boundedEff.toFixed(1)} %</div>
            </div>
        </div>
    );
};
