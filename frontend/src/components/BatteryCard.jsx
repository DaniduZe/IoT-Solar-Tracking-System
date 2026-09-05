import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import { BatteryCharging, Battery } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const BatteryCard = () => {
    const { latestData } = useTelemetry();
    
    // Battery Specs (User specified: 2x 18650 1800mAh in parallel)
    const MAX_V = 4.2;
    const MIN_V = 3.0;
    const CAPACITY_MAH = 3600; 

    const out_v = latestData?.measurements?.out_v || 0;
    const out_a = latestData?.measurements?.out_a || 0;
    const in_a = latestData?.measurements?.in_a || 0;
    
    // Simple linear SoC calculation for Li-ion 
    let soc = ((out_v - MIN_V) / (MAX_V - MIN_V)) * 100;
    soc = Math.max(0, Math.min(100, soc)); // Clamp 0-100%

    // TTE / TTF Logic
    // If solar current is greater than load current, it is charging
    const netCurrent_A = in_a - out_a;
    const netCurrent_mA = netCurrent_A * 1000;
    
    let timeText = "Analyzing...";
    let timeLabel = "Status";

    if (netCurrent_mA > 10) {
        // Charging
        const remainingCapacity_mAh = CAPACITY_MAH * (1 - (soc/100));
        const ttf_hours = remainingCapacity_mAh / netCurrent_mA;
        if (soc >= 99) {
            timeText = "Fully Charged";
            timeLabel = "Time to Full";
        } else {
            const h = Math.floor(ttf_hours);
            const m = Math.floor((ttf_hours - h) * 60);
            timeText = `${h}h ${m}m`;
            timeLabel = "Time to Full (TTF)";
        }
    } else if (netCurrent_mA < -1) {
        // Discharging
        const dischargeDraw_mA = Math.abs(netCurrent_mA);
        const usableCapacity_mAh = CAPACITY_MAH * (soc/100);
        const tte_hours = usableCapacity_mAh / dischargeDraw_mA;
        
        if (soc <= 1) {
            timeText = "Critically Low";
            timeLabel = "Time to Empty";
        } else {
            const d = Math.floor(tte_hours / 24);
            const h = Math.floor(tte_hours % 24);
            timeText = d > 0 ? `${d}d ${h}h` : `${h}h`;
            timeLabel = "Time to Empty (TTE)";
        }
    } else {
        timeText = "Idle / Balanced";
    }

    return (
        <TelemetryCard title="Battery Health" icon={netCurrent_mA > 0 ? <BatteryCharging size={20} className="text-emerald-400" /> : <Battery size={20} className="text-brand-blue" />}>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                    {/* Battery Icon visual fill */}
                    <div className="relative w-16 h-8 border-2 border-slate-500 rounded flex items-center p-[2px]">
                        <div className={`h-full transition-all ${soc < 20 ? 'bg-red-500' : soc < 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${soc}%` }}></div>
                        <div className="absolute -right-2 top-1.5 w-1.5 h-4 bg-slate-500 rounded-r-sm"></div>
                    </div>
                    <div className="text-3xl font-bold font-mono">{soc.toFixed(1)}%</div>
                </div>
                
                <div className="bg-slate-800/50 rounded p-2 text-center">
                    <div className="text-xs text-slate-400 uppercase">{timeLabel}</div>
                    <div className="font-mono text-sm font-semibold">{timeText}</div>
                </div>
            </div>
        </TelemetryCard>
    );
};
