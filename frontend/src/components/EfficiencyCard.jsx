import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import { Percent } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const EfficiencyCard = () => {
    const { latestData } = useTelemetry();
    
    const inW = (latestData?.measurements?.in_v || 0) * (latestData?.measurements?.in_a || 0);
    const outW = (latestData?.measurements?.out_v || 0) * (latestData?.measurements?.out_a || 0);
    
    // Avoid division by zero
    const efficiency = inW > 0 ? (outW / inW) * 100 : 0;
    const boundedEff = Math.min(Math.max(efficiency, 0), 100);

    return (
        <TelemetryCard title="Conversion Efficiency" icon={<Percent size={20} className="text-brand-blue" />}>
            <div className="flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 mb-2">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                            cx="50" cy="50" r="40"
                            fill="transparent"
                            stroke="rgba(59, 130, 246, 0.2)"
                            strokeWidth="10"
                        />
                        <circle
                            cx="50" cy="50" r="40"
                            fill="transparent"
                            stroke="#3b82f6"
                            strokeWidth="10"
                            strokeDasharray={`${boundedEff * 2.51} 251`}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className="text-2xl md:text-3xl font-bold text-white font-mono">{boundedEff.toFixed(1)}</span>
                        <span className="text-xs text-brand-blue font-bold">%</span>
                    </div>
                </div>
            </div>
        </TelemetryCard>
    );
};
