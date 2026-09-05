import React from 'react';

export const TelemetryCard = ({ title, icon, children, className = '' }) => {
    return (
        <div className={`glass-panel p-4 md:p-5 flex flex-col justify-between ${className}`}>
            <div className="flex items-center gap-2 mb-4">
                <div className="text-slate-400">
                    {icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{title}</h3>
            </div>
            <div className="flex-grow flex flex-col justify-end">
                {children}
            </div>
        </div>
    );
};
