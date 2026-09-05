import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import { Activity } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const SystemModeCard = () => {
    const { latestData } = useTelemetry();
    
    const in_v = latestData?.measurements?.in_v || 0;
    const in_a = latestData?.measurements?.in_a || 0;
    const out_v = latestData?.measurements?.out_v || 0;
    const isRaining = latestData?.measurements?.rain === 'YES';

    let modeTitle = "Unknown";
    let modeIcon = "❓";
    let modeColor = "text-slate-400";
    let alertMessage = null;

    if (in_v > 5.5 && out_v < 3.2) {
        modeTitle = "Battery Fault";
        modeIcon = "🔴";
        modeColor = "text-brand-red";
        alertMessage = "High solar input but extremely low output voltage. Check battery health.";
    } else if (isRaining) {
        modeTitle = "Rain Wash Mode";
        modeIcon = "🌧️";
        modeColor = "text-brand-blue";
    } else if (in_a <= 0.01 && in_v < 2.0) {
        modeTitle = "Night / Idle";
        modeIcon = "🌙";
        modeColor = "text-slate-400";
    } else if (in_v > 4.5) {
        modeTitle = "Tracking Sun";
        modeIcon = "☀️";
        modeColor = "text-brand-yellow";
    } else {
        modeTitle = "Standby";
        modeIcon = "⏳";
        modeColor = "text-slate-400";
    }

    return (
        <TelemetryCard title="System Mode" icon={<Activity size={20} className={modeColor} />}>
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <div className="text-4xl">{modeIcon}</div>
                <div className={`font-bold text-lg ${modeColor}`}>{modeTitle}</div>
                {alertMessage && (
                    <div className="mt-2 text-xs text-brand-red bg-brand-red/10 border border-brand-red/20 p-2 rounded animate-pulse">
                        {alertMessage}
                    </div>
                )}
            </div>
        </TelemetryCard>
    );
};
