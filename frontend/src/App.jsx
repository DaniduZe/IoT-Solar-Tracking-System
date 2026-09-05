import React from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { Header } from './components/Header';
import { RawSolarCard } from './components/RawSolarCard';
import { RawOutputCard } from './components/RawOutputCard';
import { BatteryCard } from './components/BatteryCard';
import { SystemModeCard } from './components/SystemModeCard';
import { KpiRow } from './components/KpiRow';
import { PowerChart } from './components/PowerChart';
import { AngleChart } from './components/AngleChart';
import { DailyEnergyChart } from './components/DailyEnergyChart';
import { ControlTerminal } from './components/ControlTerminal';

function Dashboard() {
    return (
        <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Header />
            
            <main className="flex flex-col gap-6">
                {/* Top Row: Telemetry & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <RawSolarCard />
                    <RawOutputCard />
                    <BatteryCard />
                    <SystemModeCard />
                </div>

                {/* KPI Strip */}
                <KpiRow />

                {/* Middle Row: Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 h-auto lg:h-[350px]">
                    <PowerChart />
                    <AngleChart />
                </div>
                
                {/* Daily Energy Row */}
                <div className="h-auto lg:h-[300px]">
                    <DailyEnergyChart />
                </div>

                {/* Bottom Row: Terminal */}
                <div className="h-auto lg:h-[350px]">
                    <ControlTerminal />
                </div>
            </main>
        </div>
    );
}

function App() {
    return (
        <TelemetryProvider>
            <Dashboard />
        </TelemetryProvider>
    );
}

export default App;
