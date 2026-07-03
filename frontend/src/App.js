import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Spline from '@splinetool/react-spline';
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
  Layers,
  X
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
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Effect to hide Spline watermark logo inside Shadow DOM
  useEffect(() => {
    const hideSplineLogo = () => {
      const splineViewer = document.querySelector('spline-viewer');
      if (splineViewer && splineViewer.shadowRoot) {
        const logo = splineViewer.shadowRoot.getElementById('logo');
        if (logo) {
          logo.style.display = 'none';
          logo.style.opacity = '0';
          logo.style.pointerEvents = 'none';
        }
      }
    };

    hideSplineLogo();
    const interval = setInterval(hideSplineLogo, 500);
    return () => clearInterval(interval);
  }, []);

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

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const runPrediction = async (currentCycle, currentVoltage, currentTemp, currentCapacity, currentMaxCap) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/predict`, {
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
    <div className="relative w-screen h-screen min-h-screen max-h-screen text-slate-100 bg-[#070b13] overflow-hidden font-sans flex items-center justify-center p-3 sm:p-4 md:p-6">
      
      {/* Global Glassmorphic HUD Loader */}
      {!splineLoaded && (
        <div className="fixed inset-0 bg-[#070b13] backdrop-blur-md z-50 flex flex-col items-center justify-center transition-all duration-500">
          <div className="relative flex items-center justify-center w-24 h-24 mb-6">
            {/* Spinning Outer Ring */}
            <div className="absolute inset-0 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
            {/* Pulsing Core */}
            <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/50 animate-pulse flex items-center justify-center">
              <Activity size={24} className="text-accent animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-bold uppercase tracking-[0.25em] text-white font-heading">Calibrating Digital Twin</h2>
          <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-heading">Downloading 3D Telemetry Assets...</p>
        </div>
      )}

      {/* Main Dashboard Layout Wrapper (Full horizontal length header) */}
      <div className="relative z-10 w-full h-full max-h-full max-w-[1600px] mx-auto flex flex-col justify-between gap-4 overflow-hidden">

        {/* Header (Fully transparent panel spanning the whole horizontal length) */}
        <header className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div>
              <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Edge AI Battery Intelligence System</p>
              <h1 className="mt-2 text-2xl font-extrabold font-heading text-white">Operational Command Center</h1>
            </div>
            <button
              onClick={() => setShowLogsModal(true)}
              className="mt-2 sm:mt-4 px-5 py-2.5 rounded-full bg-accent/15 border border-accent/40 text-accent hover:bg-accent hover:text-white shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] transition-all font-heading text-xs uppercase tracking-[0.2em] flex items-center gap-2 cursor-pointer"
            >
              <Activity size={14} className="animate-pulse" />
              AI Observations & Logs
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Vehicle ID', value: 'EV-09A7' },
              { label: 'Battery Pack ID', value: 'BP-1204' },
              { label: 'Telemetry Mode', value: error ? 'Simulated' : 'Live ECU API' },
              { label: 'Edge AI Status', value: 'Online', status: 'success' }
            ].map((item) => (
              <div key={item.label} className="glass-card rounded-3xl border border-white/10 px-4 py-3 bg-slate-950/20">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500 font-heading">{item.label}</p>
                <p className="mt-2 text-sm font-bold text-white flex items-center gap-2 font-heading">
                  {item.value}
                  {item.status === 'success' && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.6)]" />}
                </p>
              </div>
            ))}
          </div>
        </header>

        {/* Dashboard Content split row */}
        <div className="grid gap-6 lg:grid-cols-12 items-stretch flex-grow my-2 overflow-hidden min-h-0">

          {/* Sticky Left Column: 3D Spline Digital Twin (Static & Non-Movable) */}
          <div className="lg:col-span-4 h-full rounded-[2rem] overflow-hidden bg-transparent pointer-events-none relative flex items-center justify-center">
            {/* Ambient radial overlay to blend model into background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_35%,rgba(7,11,19,0.85)_90%)] pointer-events-none z-10" />
            <div className="w-full h-full pointer-events-none spline-canvas-wrapper">
              <Spline 
                scene="https://prod.spline.design/pp7S2-vaxeiawWvF/scene.splinecode"
                onLoad={() => setSplineLoaded(true)}
              />
            </div>
          </div>

          <main className="lg:col-span-8 flex flex-col justify-center h-full gap-6">

            {/* Split Row: Optimal Strategy (Left) & SOH Control Panel (Right - Small/Compact) */}
            <section className="grid gap-6 md:grid-cols-2">
              {/* Charging Recommendations (Optimal Strategy) */}
              <motion.div 
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Charging Recommendation</p>
                    <h2 className="mt-2 text-2xl font-bold text-white font-heading">Optimal Strategy</h2>
                  </div>
                  <Zap size={24} className="text-warning animate-pulse" />
                </div>
                <div className="mt-6 space-y-3.5 flex-grow flex flex-col justify-center">
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

              {/* SOH Control Panel (Small/Compact Sliders) */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="glass-card relative overflow-hidden rounded-[2rem] border border-white/10 p-5 shadow-glow flex flex-col justify-between"
              >
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-accent/15 to-transparent pointer-events-none" />
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="rounded-xl bg-accent/10 p-2 text-accent">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-[0.24em] text-[10px] font-heading">Edge AI Simulator</p>
                    <h2 className="text-lg font-bold text-white font-heading">SOH Control Panel</h2>
                  </div>
                </div>

                {/* Compact Sliders list */}
                <div className="space-y-3.5 relative z-10 mb-4">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1 font-heading">
                      <span>Charge Cycles</span>
                      <span className="font-semibold text-white">{cycle} Cycles</span>
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
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1 font-heading">
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
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1 font-heading">
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
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1 font-heading">
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
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1 font-heading">
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

                {/* SOH Prediction indicator (Bigger Battery Symbol) */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 font-heading">SOH Prediction</p>
                    <p className="text-xl font-extrabold font-heading mt-0.5" style={{ color: statusStroke }}>{soh}%</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-9 border border-white/20 rounded-xl p-1 flex items-center relative bg-slate-950/40">
                      <div 
                        className="h-full rounded-lg transition-all duration-300" 
                        style={{ width: `${soh}%`, backgroundColor: statusStroke }} 
                      />
                      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-white/20 rounded-r-md" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Diagnostic Insights (AI Observations) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="glass-card rounded-[2rem] border border-white/10 py-4 px-5 shadow-soft"
            >
              {/* Balanced Two Line Header */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-[9px] font-heading">AI Observations</p>
                  <h2 className="text-base font-bold text-white font-heading">Diagnostic Insights</h2>
                </div>
                <InsightsIcon size={18} className="text-accent" />
              </div>
              
              {/* Balanced Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  soh >= 90.0 ? 'Battery degradation is within the expected optimal range.' : 
                  soh >= 80.0 ? 'Mild cell degradation noticed. Keep operating temperatures below 45°C.' :
                  'Warning: High cell degradation! Internal resistance may spike under load.',
                  temperature > 45 ? 'Critical temperature spike! Battery thermal throttling recommended.' : 'Thermal profile is normal and stable.',
                  `Estimated capacity loss: ${round((1.0 - (capacity / maxCapacity)) * 100, 2)}% of original capacity.`,
                  `Current cell efficiency: ${round(soh, 1)}%`
                ].map((insight, idx) => (
                  <div key={idx} className="rounded-xl border border-white/5 bg-slate-950/20 p-3 text-[11px] font-medium leading-relaxed text-slate-300">
                    {insight}
                  </div>
                ))}
              </div>
            </motion.div>

          </main>
        </div>

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
      </div>

      {/* Telemetry & AI Observation Logs Modal Overlay */}
      <AnimatePresence>
        {showLogsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-[1200px] max-h-[90vh] overflow-y-auto rounded-[2.5rem] border border-white/10 bg-[#080e1b]/80 p-6 md:p-8 shadow-[0_25px_70px_-15px_rgba(59,130,246,0.3)] flex flex-col gap-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <p className="text-slate-400 uppercase tracking-[0.24em] text-[10px] sm:text-xs font-heading">AI Predictive Diagnostics</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-white font-heading">Telemetry & AI Observation Logs</h2>
                </div>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="rounded-full bg-white/5 border border-white/10 p-2 text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex flex-col gap-6">

                {/* AI Observations (Diagnostic Insights) */}
                <motion.div className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">AI Observations</p>
                      <h2 className="text-xl font-bold text-white font-heading">Diagnostic Insights</h2>
                    </div>
                    <InsightsIcon size={24} className="text-accent" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      soh >= 90.0 ? 'Battery degradation is within the expected optimal range.' : 
                      soh >= 80.0 ? 'Mild cell degradation noticed. Keep operating temperatures below 45°C.' :
                      'Warning: High cell degradation! Internal resistance may spike under load.',
                      temperature > 45 ? 'Critical temperature spike! Battery thermal throttling recommended.' : 'Thermal profile is normal and stable.',
                      `Estimated capacity loss: ${round((1.0 - (capacity / maxCapacity)) * 100, 2)}% of original capacity.`,
                      `Current cell efficiency: ${round(soh, 1)}%`
                    ].map((insight, idx) => (
                      <div key={idx} className="rounded-2xl border border-white/5 bg-slate-950/20 p-4 text-xs font-medium leading-relaxed text-slate-300">
                        {insight}
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Forecast & Risk Assessment */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Battery Aging Trend chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.2 }}
                    className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Battery Aging Trend</p>
                        <h2 className="text-xl font-bold text-white font-heading">Degradation Forecast</h2>
                      </div>
                      <Sparkles size={20} className="text-accent" />
                    </div>
                    <div className="h-64 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                              <stop offset="100%" stopColor="#22C55E" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="cycle" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} domain={[50, 100]} />
                          <Tooltip contentStyle={{ background: '#0D1527', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }} labelStyle={{ color: '#F8FAFC' }} itemStyle={{ color: '#F8FAFC' }} />
                          <Line type="monotone" dataKey="soh" stroke="url(#lineGradient)" strokeWidth={3} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 rounded-2xl bg-slate-950/20 p-3 border border-white/5 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-heading">Est. Coordinates</span>
                      <span className="text-white font-bold font-heading">Cycle {cycle} — SOH {soh}%</span>
                    </div>
                  </motion.div>

                  {/* Dynamic Risk Assessment Card */}
                  <motion.div className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Predictive Maintenance</p>
                        <h2 className="text-xl font-bold text-white font-heading">Risk Assessment</h2>
                      </div>
                      <ShieldCheck size={20} className="text-success" />
                    </div>
                    <div className="grid gap-3 flex-1">
                      {[
                        { label: 'Current Degradation Risk', value: soh >= 90.0 ? 'LOW' : soh >= 80.0 ? 'MEDIUM' : 'HIGH' },
                        { label: 'Next Recommended Inspection', value: soh >= 90.0 ? 'After 150 Cycles' : soh >= 80.0 ? 'After 50 Cycles' : 'INSPECT IMMEDIATELY' },
                        { label: 'Battery Core Health Status', value: statusText }
                      ].map((item) => (
                        <div key={item.label} className="glass-card rounded-2xl border border-white/5 p-3 bg-slate-900/40 flex flex-col justify-center">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-heading">{item.label}</p>
                          <p className="mt-1 text-xs font-bold text-white font-heading">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* Row 5: Cell Log History Table (Full-Width) */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  className="glass-card rounded-[2rem] border border-white/10 p-6 shadow-soft"
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-slate-400 uppercase tracking-[0.24em] text-xs font-heading">Recent Telemetry Readings</p>
                      <h2 className="text-xl font-bold text-white font-heading">Cell Log History</h2>
                    </div>
                    <Clock size={20} className="text-accent" />
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/20 shadow-soft">
                    <table className="w-full min-w-[500px] border-collapse text-left text-xs">
                      <thead className="bg-white/5 text-slate-400 font-heading">
                        <tr>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Cycle</th>
                          <th className="px-4 py-3">Cell SOH</th>
                          <th className="px-4 py-3">Temp</th>
                          <th className="px-4 py-3">Voltage</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPredictionsList.map((row, idx) => (
                          <tr key={`${row.time}-${idx}`} className="border-t border-white/5 hover:bg-white/5 transition font-medium">
                            <td className="px-4 py-3 text-white font-mono">{row.time}</td>
                            <td className="px-4 py-3">{row.cycle}</td>
                            <td className="px-4 py-3 font-mono font-bold text-white">{row.soh}</td>
                            <td className="px-4 py-3">{row.temp}</td>
                            <td className="px-4 py-3 font-mono">{row.voltage}</td>
                            <td className={`px-4 py-3 font-bold ${
                              row.status === 'Healthy' ? 'text-success' : row.status === 'Warning' ? 'text-warning' : 'text-danger'
                            }`}>{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
