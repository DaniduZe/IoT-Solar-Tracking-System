import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTelemetry } from '../context/TelemetryContext';

export const AngleChart = () => {
    const { historyData } = useTelemetry();

    const chartData = useMemo(() => {
        return historyData.map(doc => {
            const timeObj = new Date(doc.timestamp);
            return {
                time: `${timeObj.getHours().toString().padStart(2, '0')}:${timeObj.getMinutes().toString().padStart(2, '0')}:${timeObj.getSeconds().toString().padStart(2, '0')}`,
                angle: doc.measurements.angle || 0
            };
        });
    }, [historyData]);

    return (
        <div className="glass-panel p-4 md:p-5 flex flex-col h-full min-h-[250px] md:min-h-[350px]">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Tracking Dynamics</h3>
            <div className="flex-grow w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                        <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 180]} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                            itemStyle={{ color: '#3b82f6' }}
                        />
                        <Line type="stepAfter" dataKey="angle" name="Servo Angle (°)" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
