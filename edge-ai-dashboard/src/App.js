import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BatteryCharging,
  Cpu,
  Activity,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Zap,
  Thermometer,
  Clock,
  Sparkles as InsightsIcon,
  Shield,
  Layers
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const trendData = Array.from({ length: 12 }, (_, i) => ({
  cycle: 50 * i,
  soh: 100 - Math.pow(i, 1.25) * 2.6
}));

function StatCard({ label, value, icon, color }) {
  const Icon = icon;
  return (
    <div className="glass-card rounded-3xl border border-white/10 p-5 shadow-glow transition hover:-translate-y-1 hover:border-accent/40">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-[0.24em] font-heading">{label}</p>
          <p className="mt-3 text-2xl font-bold text-white font-heading">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-3xl bg-white/5 flex items-center justify-center text-${color}-400`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function App() {
  // Input parameters state for simulation
  const [cycle, setCycle] = useState(524);
  const [voltage, setVoltage] = useState(3.98);
  const [temperature, setTemperature] = useState(31.0);
  const [capacity, setCapacity] = useState(1.86);
  const [maxCapacity, setMaxCapacity] = useState(2.00);

  // Output states
  const [soh, setSoh] = useState(94.8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Predictions history log state
  const [recentPredictionsList, setRecentPredictionsList] = useState([
    { time: '14:02', cycle: 524, soh: '94.8%', temp: '31.0°C', voltage: '3.98V', status: 'Healthy' },
    { time: '13:47', cycle: 500, soh: '95.2%', temp: '30.0°C', voltage: '4.00V', status: 'Healthy' },
    { time: '13:12', cycle: 485, soh: '95.6%', temp: '30.0°C', voltage: '4.02V', status: 'Healthy' },
    { time: '12:35', cycle: 470, soh: '96.0%', temp: '29.0°C', voltage: '4.05V', status: 'Healthy' }
  ]);

  const round = (val, dec) => parseFloat(val.toFixed(dec));

  const runPrediction = async (currentCycle, currentVoltage, currentTemp, currentCapacity, currentMaxCap) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cycle: currentCycle,
          voltage: currentVoltage,
          temperature: currentTemp,
          capacity: currentCapacity,
          max_capacity: currentMaxCap
        })
      });

      if (!response.ok) {
        throw new Error('API server returned error');
      }

      const data = await response.json();
      setSoh(data.soh_percentage);
      setError(null);

      // Add to recent predictions logs
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      let status = 'Healthy';
      if (data.soh_percentage < 80.0) status = 'Critical';
      else if (data.soh_percentage < 90.0) status = 'Warning';

      setRecentPredictionsList(prev => [
        {
          time: timeStr,
          cycle: currentCycle,
          soh: `${data.soh_percentage}%`,
          temp: `${currentTemp.toFixed(1)}°C`,
          voltage: `${currentVoltage.toFixed(2)}V`,
          status: status
        },
        ...prev.slice(0, 9)
      ]);

    } catch (err) {
      console.warn("Backend API not reachable. Using interactive simulation logic instead.", err);
      setError('Backend API Offline (Using Simulated Fallback)');
      
      // Calculate realistic simulation formula if backend is offline
      const capacityLoss = 1.0 - (currentCapacity / currentMaxCap);
      const calculatedSoh = 100.0 - (currentCycle * 0.012) - (capacityLoss * 35.0) + (currentVoltage - 3.7) * 4.0 - (currentTemp - 25) * 0.08;
      const finalSoh = Math.max(5.0, Math.min(100.0, round(calculatedSoh, 2)));
      
      setSoh(finalSoh);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      let status = 'Healthy';
      if (finalSoh < 80.0) status = 'Critical';
      else if (finalSoh < 90.0) status = 'Warning';

      setRecentPredictionsList(prev => [
        {
          time: timeStr,
          cycle: currentCycle,
          soh: `${finalSoh}% (Sim)`,
          temp: `${currentTemp.toFixed(1)}°C`,
          voltage: `${currentVoltage.toFixed(2)}V`,
          status: status
        },
        ...prev.slice(0, 9)
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      runPrediction(cycle, voltage, temperature, capacity, maxCapacity);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [cycle, voltage, temperature, capacity, maxCapacity]);

  // Derived styling states
  let statusText = 'Healthy';
  let statusColor = 'text-success';
  let statusStroke = '#22C55E';
  if (soh < 80.0) {
    statusText = 'Critical';
    statusColor = 'text-danger';
    statusStroke = '#EF4444';
  } else if (soh < 90.0) {
    statusText = 'Warning';
    statusColor = 'text-warning';
    statusStroke = '#F59E0B';
  }

  // Radius & Circumference of SOH Circular Gauge
  const radius = 80;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - soh / 100);

  return (
    <div className="dashboard-shell min-h-screen px-6 py-6 text-slate-100 bg-[#070b13]">
      <main className="w-full flex flex-col gap-6">
        
        {/* Header */}
        <header className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Edge AI Battery Intelligence System</p>
            <h1 className="mt-3 text-3xl font-extrabold font-heading text-white">Operational Command Center</h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Vehicle ID', value: 'EV-09A7' },
              { label: 'Battery Pack ID', value: 'BP-1204' },
              { label: 'Telemetry Mode', value: error ? 'Simulated' : 'Live ECU API' },
              { label: 'Edge AI Status', value: 'Online', status: 'success' }
            ].map((item) => (
              <div key={item.label} className="glass-card rounded-3xl border border-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500 font-heading">{item.label}</p>
                <p className="mt-2 text-sm font-bold text-white flex items-center gap-2 font-heading">
                  {item.value}
                  {item.status === 'success' && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.6)]" />}
                </p>
              </div>
            ))}
          </div>
        </header>

        {/* SOH Output Card (Featured Banner at the Top) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="glass-card relative overflow-hidden rounded-[2rem] border border-white/10 p-6 shadow-glow"
        >
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent/15 to-transparent" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
            <div>
              <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Core Analysis Summary</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-300 font-heading">Battery State of Health (SOH)</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-6xl font-extrabold text-white font-heading">{soh}%</span>
                <span className="text-slate-400 text-sm">efficiency</span>
              </div>
              <p className="mt-4 text-slate-300 text-sm flex items-center gap-2">
                Status Assessment:
                <span className={`font-bold px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 ${statusColor}`}>
                  {statusText}
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* Micro Stats inside Banner */}
              <div className="grid gap-3 grid-cols-2 w-full sm:w-auto">
                {[
                  { label: 'Battery ID', value: 'BP-1204' },
                  { label: 'Cell Grouping', value: '96S1P (Li-Ion)' },
                  { label: 'Diagnostics Status', value: 'BMS Nominal' },
                  { label: 'Cell Status', value: 'Optimized' }
                ].map((item) => (
                  <div key={item.label} className="glass-card rounded-2xl border border-white/5 px-4 py-3 bg-slate-950/20 min-w-[140px]">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-heading">{item.label}</p>
                    <p className="mt-1.5 text-xs font-bold text-white font-heading">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Circular Gauge */}
              <div className="relative flex h-48 w-48 items-center justify-center text-center">
                <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 192 192">
                  <circle
                    cx="96"
                    cy="96"
                    r={radius}
                    className="stroke-white/5 fill-transparent"
                    strokeWidth={strokeWidth}
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r={radius}
                    className="fill-transparent transition-all duration-300"
                    stroke={statusStroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    filter="drop-shadow(0px 0px 8px rgba(59,130,246,0.3))"
                  />
                </svg>
                <div className="relative flex flex-col h-36 w-36 items-center justify-center rounded-full bg-[#0D1527] shadow-[inset_0_0_20px_rgba(255,255,255,0.03)] border border-white/5">
                  <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-heading">Health</p>
                  <p className="mt-1 text-3xl font-extrabold text-white font-heading">{soh}%</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Grid (Two columns layout balanced to be of equal heights) */}
        <section className="grid gap-6 xl:grid-cols-12">
          
          {/* Left Column (Interactive Simulator, AI Observations & Strategies) - Spans 6 cols */}
          <div className="xl:col-span-6 flex flex-col gap-6">
            
            {/* Interactive SOH Simulator Card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="glass-card relative overflow-hidden rounded-[2rem] border border-white/10 p-6 shadow-glow animate-glow"
            >
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-accent/15 to-transparent" />
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="rounded-2xl bg-accent/10 p-3 text-accent shadow-[0_0_10px_rgba(59,130,246,0.15)]">
                  <Cpu size={20} />
                </div>
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Edge AI Simulator</p>
                  <h2 className="text-2xl font-bold text-white font-heading">Interactive SOH Predictor</h2>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 relative z-10">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-slate-300 mb-1.5 font-heading">
                      <span>Charge Cycles</span>
                      <span className="font-semibold text-white">{cycle}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="1000"
                      value={cycle}
                      onChange={(e) => setCycle(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-slate-300 mb-1.5 font-heading">
                      <span>Cell Voltage</span>
                      <span className="font-semibold text-white">{voltage.toFixed(2)} V</span>
                    </div>
                    <input
                      type="range"
                      min="3.0"
                      max="4.5"
                      step="0.01"
                      value={voltage}
                      onChange={(e) => setVoltage(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-slate-300 mb-1.5 font-heading">
                      <span>Cell Temperature</span>
                      <span className="font-semibold text-white">{temperature.toFixed(1)} °C</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="65"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-slate-300 mb-1.5 font-heading">
                      <span>Current Capacity</span>
                      <span className="font-semibold text-white">{capacity.toFixed(2)} Ah</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.5"
                      step="0.01"
                      value={capacity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCapacity(val);
                        if (val > maxCapacity) {
                          setMaxCapacity(val);
                        }
                      }}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-slate-300 mb-1.5 font-heading">
                      <span>Nominal Max Capacity</span>
                      <span className="font-semibold text-white">{maxCapacity.toFixed(2)} Ah</span>
                    </div>
                    <input
                      type="range"
                      min="1.5"
                      max="2.5"
                      step="0.01"
                      value={maxCapacity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setMaxCapacity(val);
                        if (val < capacity) {
                          setCapacity(val);
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="glass-card rounded-3xl bg-[#0b0f19] p-5 border border-white/5 flex flex-col justify-between shadow-soft">
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-1.5 font-heading">
                      <BatteryCharging size={12} className="text-accent" />
                      Cell Visual Telemetry
                    </h3>
                    
                    {/* Visual Battery Graphic */}
                    <div className="flex items-center justify-center py-4">
                      <div className="relative w-36 h-16 border-2 border-white/20 rounded-lg p-1 flex items-center gap-1">
                        {/* Inner Charge Bars */}
                        {Array.from({ length: 4 }).map((_, idx) => {
                          const threshold = (idx + 1) * 25;
                          const isFilled = soh >= threshold;
                          return (
                            <div
                              key={idx}
                              className={`h-full flex-1 rounded-sm transition-all duration-300 ${
                                isFilled
                                  ? soh >= 90
                                    ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                    : soh >= 80
                                    ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                    : 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                                  : 'bg-white/5'
                              }`}
                            />
                          );
                        })}
                        {/* Battery Positive Terminal Tip */}
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2 h-6 bg-white/20 rounded-r-sm" />
                      </div>
                    </div>

                    <div className="space-y-2 text-xs mt-2">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-400 font-heading">Cell Balance:</span>
                        <span className="text-success font-semibold font-heading">Nominal (±0.02V)</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-400 font-heading">Thermal Throttling:</span>
                        <span className={`${temperature > 45.0 ? 'text-warning font-semibold' : 'text-slate-300'} font-heading`}>
                          {temperature > 45.0 ? 'Active AC Cooling' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-400 font-heading">Internal Resistance:</span>
                        <span className="text-white font-semibold font-heading">18 mΩ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-heading">Est. Remaining Life:</span>
                        <span className="text-white font-semibold font-heading">{Math.max(100, 1500 - cycle)} Cycles</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1.5 font-heading">
                      <span className={`inline-flex h-2 w-2 rounded-full ${error ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`} />
                      {error ? 'Telemetry Simulator Active' : 'ECU Feed Active'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Dynamic AI Insights Card */}
            <motion.div className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">AI Insights</p>
                  <h2 className="text-2xl font-bold text-white font-heading">Operational Observations</h2>
                </div>
                <InsightsIcon size={24} className="text-accent" />
              </div>
              <ul className="space-y-3 text-slate-300">
                {[
                  soh >= 90.0 ? 'Battery degradation is within the expected optimal range.' : 
                  soh >= 80.0 ? 'Mild cell degradation noticed. Keep operating temperatures below 45°C.' :
                  'Warning: High cell degradation! Internal resistance may spike under load.',
                  temperature > 45 ? 'Critical temperature spike! Battery thermal throttling recommended.' : 'Thermal profile is normal and stable.',
                  `Estimated capacity loss: ${round((1.0 - (capacity / maxCapacity)) * 100, 2)}% of original capacity.`,
                  `Current cell efficiency: ${round(soh, 1)}%`
                ].map((insight, idx) => (
                  <li key={idx} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm font-medium leading-relaxed">
                    {insight}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Charging Recommendations */}
            <motion.div className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Charging Recommendation</p>
                  <h2 className="mt-2 text-2xl font-bold text-white font-heading">Optimal Strategy</h2>
                </div>
                <Zap size={24} className="text-warning" />
              </div>
              <div className="mt-6 space-y-4">
                {[
                  { title: 'Recommended Charge Profile', detail: temperature > 40.0 ? 'Slow AC Trickle Charge' : soh < 80.0 ? 'Controlled AC Charging' : 'Normal AC Charging' },
                  { title: 'DC Fast Charge Status', detail: temperature > 35.0 ? 'Not Recommended (High Temp)' : soh < 80.0 ? 'Avoid (High Degradation)' : 'Supported (< 80% SOC)' },
                  { title: 'Target Charge Limit', detail: soh < 85.0 ? '75% (Prolong Life)' : '80% (Recommended)' }
                ].map((item) => (
                  <div key={item.title} className="glass-card rounded-3xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500 font-heading">{item.title}</p>
                    <p className="mt-2 text-white font-bold font-heading">{item.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column (Metrics, Risk & Degradation Trend Chart) - Spans 6 cols */}
          <div className="xl:col-span-6 flex flex-col gap-6">
            
            {/* Dynamic Real-Time Metrics Card */}
            <motion.div className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Battery Status</p>
                  <h2 className="mt-2 text-2xl font-bold text-white font-heading">Real-Time Metrics</h2>
                </div>
                <BatteryCharging size={24} className="text-accent" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <StatCard label="SOC" value="82%" icon={Zap} color="accent" />
                <StatCard label="Cell Temp" value={`${temperature.toFixed(1)}°C`} icon={Thermometer} color="warning" />
                <StatCard label="Cell Voltage" value={`${voltage.toFixed(2)} V`} icon={Zap} color="accent" />
                <StatCard label="Cell Capacity" value={`${capacity.toFixed(2)} Ah`} icon={Layers} color="success" />
                <StatCard label="Sim Cycles" value={cycle.toString()} icon={Activity} color="accent" />
                <StatCard label="Nominal Max Cap" value={`${maxCapacity.toFixed(2)} Ah`} icon={Shield} color="success" />
              </div>
            </motion.div>

            {/* Dynamic Risk Assessment Card */}
            <motion.div className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Predictive Maintenance</p>
                  <h2 className="mt-2 text-2xl font-bold text-white font-heading">Risk Assessment</h2>
                </div>
                <ShieldCheck size={24} className="text-success" />
              </div>
              <div className="mt-6 grid gap-4">
                {[
                  { label: 'Current Degradation Risk', value: soh >= 90.0 ? 'LOW' : soh >= 80.0 ? 'MEDIUM' : 'HIGH' },
                  { label: 'Next Recommended Inspection', value: soh >= 90.0 ? 'After 150 Cycles' : soh >= 80.0 ? 'After 50 Cycles' : 'INSPECT IMMEDIATELY' },
                  { label: 'Battery Core Health Status', value: statusText }
                ].map((item) => (
                  <div key={item.label} className="glass-card rounded-3xl border border-white/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500 font-heading">{item.label}</p>
                    <p className="mt-2 text-sm font-bold text-white font-heading">{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Battery Aging Trend chart */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft flex-1 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Battery Aging Trend</p>
                  <h2 className="mt-2 text-2xl font-bold text-white font-heading">Degradation Forecast</h2>
                </div>
                <Sparkles size={24} className="text-accent" />
              </div>
              <div className="h-72 flex-1 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="cycle" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[50, 100]} />
                    <Tooltip contentStyle={{ background: '#0D1527', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }} labelStyle={{ color: '#F8FAFC' }} itemStyle={{ color: '#F8FAFC' }} />
                    <Line type="monotone" dataKey="soh" stroke="url(#lineGradient)" strokeWidth={4} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 rounded-3xl bg-white/5 p-4 border border-white/10 flex items-center justify-between text-sm">
                <span className="text-slate-400 font-heading">Current simulated cell coordinates</span>
                <span className="text-white font-bold font-heading">Cycle {cycle} — SOH {soh}%</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Dynamic Real-Time Sensor Feed */}
        <motion.div className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Real-Time Sensor Feed</p>
              <h2 className="mt-2 text-2xl font-bold text-white font-heading">Live Gauge Telemetry</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-heading">Reactive Model Inference Logged</span>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Voltage', value: `${voltage.toFixed(2)} V`, fill: (voltage - 3.0) / (4.5 - 3.0) * 100, color: 'accent' },
              { label: 'Temperature', value: `${temperature.toFixed(1)}°C`, fill: (temperature - 10) / (65 - 10) * 100, color: 'warning' },
              { label: 'Capacity', value: `${capacity.toFixed(2)} Ah`, fill: (capacity - 1.0) / (2.5 - 1.0) * 100, color: 'success' },
              { label: 'SOC', value: '82%', fill: 82, color: 'accent' }
            ].map((sensor) => (
              <div key={sensor.label} className="glass-card rounded-3xl border border-white/10 p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 font-heading">{sensor.label}</p>
                  <span className="text-white font-bold text-sm font-heading">{sensor.value}</span>
                </div>
                <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, sensor.fill))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Dynamic Recent Inference Log Table (Moved to full-width position at the bottom) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Recent Telemetry Readings</p>
              <h2 className="mt-2 text-2xl font-bold text-white font-heading">Cell Log History</h2>
            </div>
            <Clock size={24} className="text-accent" />
          </div>
          <div className="overflow-x-auto rounded-3xl border border-white/10 shadow-soft">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-white/5 text-slate-400 font-heading">
                <tr>
                  <th className="px-5 py-4">Time</th>
                  <th className="px-5 py-4">Cycle</th>
                  <th className="px-5 py-4">Cell SOH</th>
                  <th className="px-5 py-4">Temperature</th>
                  <th className="px-5 py-4">Voltage</th>
                  <th className="px-5 py-4">Operating Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPredictionsList.map((row, idx) => (
                  <tr key={`${row.time}-${idx}`} className="border-t border-white/10 hover:bg-white/5 transition font-medium">
                    <td className="px-5 py-4 text-white font-mono">{row.time}</td>
                    <td className="px-5 py-4">{row.cycle}</td>
                    <td className="px-5 py-4 font-mono font-bold text-white">{row.soh}</td>
                    <td className="px-5 py-4">{row.temp}</td>
                    <td className="px-5 py-4 font-mono">{row.voltage}</td>
                    <td className={`px-5 py-4 font-bold ${
                      row.status === 'Healthy' ? 'text-success' : row.status === 'Warning' ? 'text-warning' : 'text-danger'
                    }`}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Footer */}
        <footer className="glass-card rounded-[2rem] border border-white/10 p-6 text-slate-400 shadow-soft flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-heading">Vehicle Battery Management System (BMS)</p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-xs font-heading">
            <span className="rounded-3xl bg-white/5 px-4 py-2 text-center border border-white/5">Diagnostics: Nominal</span>
            <span className="rounded-3xl bg-white/5 px-4 py-2 text-center border border-white/5">CAN Connection: Active</span>
            <span className="rounded-3xl bg-white/5 px-4 py-2 text-center border border-white/5">Thermal Management: Auto</span>
            <span className="rounded-3xl bg-white/5 px-4 py-2 text-center border border-white/5">ECU Telemetry: Live</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
