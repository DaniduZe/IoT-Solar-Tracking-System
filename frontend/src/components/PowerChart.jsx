import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTelemetry } from '../context/TelemetryContext';

export const PowerChart = () => {
    const { historyData } = useTelemetry();

    const chartData = useMemo(() => {
        return historyData.map(doc => {
            const inW = (doc.measurements.in_v * doc.measurements.in_a) || 0;
            const outW = (doc.measurements.out_v * doc.measurements.out_a) || 0;
            const timeObj = new Date(doc.timestamp);
            return {
                time: `${timeObj.getHours().toString().padStart(2, '0')}:${timeObj.getMinutes().toString().padStart(2, '0')}:${timeObj.getSeconds().toString().padStart(2, '0')}`,
                inW: parseFloat(inW.toFixed(2)),
                outW: parseFloat(outW.toFixed(2))
            };
        });
    }, [historyData]);

    return (
        <div className="glass-panel p-4 md:p-5 flex flex-col h-full min-h-[250px] md:min-h-[350px]">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Power Analytics</h3>
            <div className="flex-grow w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                            itemStyle={{ color: '#f8fafc' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="inW" name="Input (W)" stroke="#eab308" fillOpacity={1} fill="url(#colorIn)" isAnimationActive={false} />
                        <Area type="monotone" dataKey="outW" name="Output (W)" stroke="#22c55e" fillOpacity={1} fill="url(#colorOut)" isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
