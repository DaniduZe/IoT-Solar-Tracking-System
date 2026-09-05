import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const DailyEnergyChart = () => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchDaily = async () => {
            try {
                const res = await fetch('/api/telemetry/daily');
                if (res.ok) {
                    const json = await res.json();
                    const formatted = json.map(d => ({
                        date: d.date,
                        wh: parseFloat(d.wh.toFixed(2))
                    }));
                    setData(formatted);
                }
            } catch (err) {
                console.error("Failed to fetch daily data", err);
            }
        };
        fetchDaily();
        
        // Refresh every 5 minutes
        const interval = setInterval(fetchDaily, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="glass-panel p-4 md:p-5 flex flex-col h-full min-h-[250px] md:min-h-[350px]">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Daily Energy Yield (Wh)</h3>
            <div className="flex-grow w-full h-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                itemStyle={{ color: '#f8fafc' }}
                                cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                            />
                            <Bar dataKey="wh" name="Energy (Wh)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                        Gathering data...
                    </div>
                )}
            </div>
        </div>
    );
};
