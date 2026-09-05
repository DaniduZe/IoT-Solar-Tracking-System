import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Droplets, Moon, RefreshCw } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const ControlTerminal = () => {
    const { historyData, latestData } = useTelemetry();
    const [angleInput, setAngleInput] = useState(90);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [events, setEvents] = useState([
        { time: new Date().toLocaleTimeString(), text: 'System initialized. Waiting for telemetry...' }
    ]);
    const logEndRef = useRef(null);

    // Initial angle sync
    useEffect(() => {
        if (latestData?.measurements?.angle !== undefined) {
            setAngleInput(latestData.measurements.angle);
        }
    }, [historyData.length === 0]); // Only sync on first load

    // Generate events based on telemetry changes
    useEffect(() => {
        if (!latestData) return;
        
        const now = new Date(latestData.timestamp).toLocaleTimeString();
        if (latestData.measurements.rain === 'YES') {
            setEvents(prev => {
                const lastEvent = prev[prev.length - 1];
                if (!lastEvent.text.includes('Rain detected')) {
                    return [...prev, { time: now, text: 'WARNING: Rain detected. Staging panel to 60°' }];
                }
                return prev;
            });
        }
    }, [latestData]);

    // Auto-scroll
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [events]);

    const sendCommand = async (payload) => {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            const now = new Date().toLocaleTimeString();
            if (res.ok) {
                setEvents(prev => [...prev, { time: now, text: `> MQTT: ${data.message}` }]);
            } else {
                setEvents(prev => [...prev, { time: now, text: `> ERROR: ${data.error}` }]);
            }
        } catch (err) {
            setEvents(prev => [...prev, { time: new Date().toLocaleTimeString(), text: '> ERROR: Network failure' }]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAngleSubmit = (e) => {
        e.preventDefault();
        sendCommand({ angle: Number(angleInput) });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Override Controls */}
            <div className="glass-panel p-5 flex flex-col justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Remote Control Panel</h3>
                    <p className="text-xs text-slate-500 mb-6">Publish commands over MQTT directly to the ESP32.</p>
                </div>
                
                <form onSubmit={handleAngleSubmit} className="flex flex-col gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <input 
                            type="range" 
                            min="0" 
                            max="180" 
                            value={angleInput}
                            onChange={(e) => setAngleInput(e.target.value)}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                            style={{ minHeight: '44px' }}
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="relative flex-grow">
                            <input 
                                type="number" 
                                min="0" max="180"
                                value={angleInput}
                                onChange={(e) => setAngleInput(e.target.value)}
                                className="glass-input w-full text-2xl font-mono text-center"
                            />
                            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">&deg;</span>
                        </div>
                        
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Send size={18} />
                            {isSubmitting ? 'Sending...' : 'SUBMIT'}
                        </button>
                    </div>
                </form>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-700/50 pt-4">
                    <button onClick={() => sendCommand({command: 'clean'})} disabled={isSubmitting} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
                        <Droplets size={16} className="mb-1 text-brand-blue" />
                        CLEAN
                    </button>
                    <button onClick={() => sendCommand({command: 'sleep'})} disabled={isSubmitting} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
                        <Moon size={16} className="mb-1 text-slate-400" />
                        SLEEP
                    </button>
                    <button onClick={() => { if(window.confirm('Reboot ESP32?')) sendCommand({command: 'reboot'})}} disabled={isSubmitting} className="flex flex-col items-center justify-center p-2 bg-brand-red/20 hover:bg-brand-red/30 text-brand-red rounded-lg text-xs font-semibold transition-colors">
                        <RefreshCw size={16} className="mb-1" />
                        REBOOT
                    </button>
                </div>
            </div>

            {/* Event Log Terminal */}
            <div className="glass-panel p-0 overflow-hidden flex flex-col bg-[#0d1117]">
                <div className="bg-[#161b22] px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                    <Terminal size={16} className="text-slate-400" />
                    <span className="text-xs font-mono text-slate-400">system.log</span>
                </div>
                <div className="p-4 flex-grow overflow-y-auto font-mono text-sm max-h-[250px] lg:max-h-full">
                    {events.map((ev, i) => (
                        <div key={i} className="mb-1 leading-relaxed">
                            <span className="text-slate-500">[{ev.time}]</span>{' '}
                            <span className={ev.text.includes('ERROR') ? 'text-brand-red' : ev.text.includes('WARNING') ? 'text-brand-yellow' : 'text-emerald-400'}>
                                {ev.text}
                            </span>
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </div>
        </div>
    );
};
