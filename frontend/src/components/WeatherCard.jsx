import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import { Compass, CloudRain } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const WeatherCard = () => {
    const { latestData } = useTelemetry();
    
    const angle = latestData?.measurements?.angle || 90;
    const isRaining = latestData?.measurements?.rain === 'YES';

    return (
        <TelemetryCard 
            title="Position & Weather" 
            icon={<Compass size={20} className={isRaining ? "text-brand-red animate-pulse" : "text-slate-300"} />}
            className={isRaining ? "animate-flash-warning border-brand-red/50" : ""}
        >
            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <span className="text-sm text-slate-400 mb-1">Servo Angle</span>
                    <div className="text-3xl md:text-4xl font-bold text-white font-mono">
                        {angle}&deg;
                    </div>
                </div>
                
                <div className="flex flex-col items-end">
                    <span className="text-sm text-slate-400 mb-1">Status</span>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${isRaining ? 'bg-brand-red/20 text-brand-red' : 'bg-slate-800 text-slate-300'}`}>
                        <CloudRain size={16} />
                        {isRaining ? "RAINING" : "CLEAR"}
                    </div>
                </div>
            </div>
        </TelemetryCard>
    );
};
