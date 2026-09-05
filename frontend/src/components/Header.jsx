import React, { useState, useEffect } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { Activity, Clock } from 'lucide-react';

export const Header = () => {
    const { connectionStatus } = useTelemetry();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const statusConfig = {
        connected: { color: 'bg-brand-green', text: 'Live', ping: true },
        connecting: { color: 'bg-brand-yellow', text: 'Connecting...', ping: true },
        disconnected: { color: 'bg-brand-red', text: 'Offline', ping: false }
    };
    const currentStatus = statusConfig[connectionStatus] || statusConfig.disconnected;

    return (
        <header className="glass-panel p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-blue/20 rounded-lg">
                    <Activity className="text-brand-blue" size={24} />
                </div>
                <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                    Solar Array Telemetry Studio
                </h1>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-slate-300">
                    <Clock size={18} />
                    <span className="font-mono text-sm">{time.toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-400">{currentStatus.text}</span>
                    <div className="relative flex h-3 w-3">
                        {currentStatus.ping && (
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStatus.color}`}></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${currentStatus.color}`}></span>
                    </div>
                </div>
            </div>
        </header>
    );
};
