import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const TelemetryContext = createContext(null);

export const useTelemetry = () => useContext(TelemetryContext);

export const TelemetryProvider = ({ children }) => {
    const [historyData, setHistoryData] = useState([]);
    const [latestData, setLatestData] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const wsRef = useRef(null);

    // Initial Fetch
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // In dev this proxies to localhost:5000 via vite.config.js
                // In prod we use relative path
                const response = await fetch('/api/telemetry');
                if (response.ok) {
                    const data = await response.json();
                    setHistoryData(data);
                    if (data.length > 0) {
                        setLatestData(data[data.length - 1]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch history:', err);
            }
        };
        fetchHistory();
    }, []);

    // WebSocket Setup
    useEffect(() => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // If dev server (localhost:5173), we want to connect to localhost:5000 for WS.
        // If prod, we connect to the same host.
        const wsHost = window.location.port === '5173' ? 'localhost:5000' : window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}`;
        
        const connect = () => {
            setConnectionStatus('connecting');
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => setConnectionStatus('connected');
            
            ws.onmessage = (event) => {
                try {
                    const doc = JSON.parse(event.data);
                    setLatestData(doc);
                    setHistoryData(prev => {
                        const newHistory = [...prev, doc];
                        // Cap history at 200 points to prevent memory leaks and UI lag
                        if (newHistory.length > 200) return newHistory.slice(newHistory.length - 200);
                        return newHistory;
                    });
                } catch (e) {
                    console.error('Error parsing WS message:', e);
                }
            };

            ws.onclose = () => {
                setConnectionStatus('disconnected');
                // Reconnect after 3 seconds
                setTimeout(connect, 3000);
            };

            ws.onerror = (err) => {
                console.error('WebSocket Error:', err);
                ws.close();
            };
        };

        connect();

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    return (
        <TelemetryContext.Provider value={{ historyData, latestData, connectionStatus }}>
            {children}
        </TelemetryContext.Provider>
    );
};
