// UserStats.jsx (sin barras + gráficos extra)
import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell
} from 'recharts';

const PALETTE = {
  blue: '#3B82F6',
  blueSoft: '#93C5FD',
  indigo: '#6366F1',
  indigoSoft: '#A5B4FC',
  green: '#34D399',
  amber: '#F59E0B',
  red: '#F87171',
  gray400: '#9CA3AF',
  grid: '#E5E7EB'
};
const API_BASE = (import.meta.env?.VITE_API_BASE ?? 'http://localhost:3001');

const fmtPct = (v) => (v == null ? '-' : `${Number(v).toFixed(0)}%`);
const fmtWeekStr = (w) => {
  if (!w) return '';
  const s = String(w);
  return `${s.slice(0, 4)}·W${s.slice(4)}`;
};

const EmptyState = ({ text = 'No data yet.' }) => (
  <div className="flex items-center justify-center h-40 text-sm text-gray-400 italic">{text}</div>
);

const NiceTooltip = ({ active, payload, label, mode }) => {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-white/95 backdrop-blur shadow px-3 py-2 rounded-lg border border-gray-200 text-xs">
      {mode === 'week' && <div className="font-medium text-gray-700 mb-1">{fmtWeekStr(label)}</div>}
      {mode === 'hour' && <div className="font-medium text-gray-700 mb-1">{label}:00</div>}
      {mode === 'topic' && <div className="font-medium text-gray-700 mb-1">{label}</div>}
      <div className="text-gray-600">{mode === 'count' ? val : fmtPct(val)}</div>
    </div>
  );
};

const UserStats = ({ googleId, selectedLevel }) => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let aborted = false;
    const fetchStats = async () => {
      try {
        setError('');
        if (!googleId) return;
        const encodedId = encodeURIComponent(String(googleId));
        const url = new URL(`${API_BASE}/api/user-stats/${encodedId}`);
        if (selectedLevel) url.searchParams.set('level', selectedLevel);
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch stats');
        const json = await res.json();
        if (!aborted) setStats(json);
      } catch (err) {
        console.error('❌ Error loading stats:', err);
        if (!aborted) setError('Could not load your stats right now.');
      }
    };
    fetchStats();
    return () => { aborted = true; };
  }, [googleId, selectedLevel]);

  const derived = useMemo(() => {
    if (!stats) return null;

    // KPIs
    const currentStreak = stats.kpis?.currentStreak ?? 0;
    const bestStreak = stats.kpis?.bestStreak ?? 0;
    const last7dSessions = stats.kpis?.last7dSessions ?? 0;
    const rolling4wAccuracyPct = stats.kpis?.rolling4wAccuracyPct ?? 0;

    // Series del backend nuevo
    const weeklyAccuracy = (stats.weeklyAccuracy ?? []).map(d => ({ ...d, label: fmtWeekStr(d.week) }));
    const hourlyAccuracy = stats.hourlyAccuracy ?? [];
    const topicAccuracy = (stats.topicAccuracy ?? []).slice().sort((a, b) => a.accPct - b.accPct);
    const xpWeekly = stats.xpProgressWeekly ?? [];
    const levelComparative = stats.levelComparative ?? [];

    // Radar comparativo por nivel
    const radarLevelStats = levelComparative.map(x => ({
      level: x.level,
      accuracy: Math.round((x.acc || 0) * 100)
    }));

    // Progreso mixto por nivel activo
    const WEIGHTS = { perSession: 3, accFactor: 0.4, cap: 100 };
    const levelSessions = stats.levelSessions ?? 0;
    const levelAccuracyPct = stats.levelAccuracyPct ?? 0;
    const mixedProgress = (levelSessions * WEIGHTS.perSession) + (levelAccuracyPct * WEIGHTS.accFactor);
    const levelProgress = Math.min(WEIGHTS.cap, Math.round(mixedProgress));
    const activeLevel = selectedLevel || (radarLevelStats[0]?.level ?? 'A1');

    // Sparkline últimas 4 semanas
    const spark = weeklyAccuracy.slice(-4);

    // Para radar por temas: convertir a {topic, value}
    const radarTopics = topicAccuracy.map(t => ({ topic: t.topic || '—', value: t.accPct || 0 }));

    return {
      kpis: { currentStreak, bestStreak, last7dSessions, rolling4wAccuracyPct },
      weeklyAccuracy,
      hourlyAccuracy,
      radarTopics,
      xpWeekly,
      radarLevelStats,
      levelProgress,
      levelSessions,
      levelAccuracyPct,
      activeLevel,
      spark
    };
  }, [stats, selectedLevel]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!derived) return <p className="text-sm text-gray-500">Loading progress...</p>;

  const {
    kpis, weeklyAccuracy, hourlyAccuracy, radarTopics, xpWeekly,
    radarLevelStats, levelProgress, levelSessions, levelAccuracyPct, activeLevel, spark
  } = derived;

  const pieData = [
    { name: 'Accuracy', value: levelAccuracyPct, color: PALETTE.indigo },
    { name: 'Miss', value: Math.max(0, 100 - levelAccuracyPct), color: PALETTE.gray400 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* KPI cards con sparkline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <p className="text-xs text-gray-500">Current Streak</p>
          <p className="text-2xl font-bold text-blue-800">{kpis.currentStreak} days</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <p className="text-xs text-gray-500">Best Streak</p>
          <p className="text-2xl font-bold text-blue-800">{kpis.bestStreak} days</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <p className="text-xs text-gray-500">Sessions (last 7d)</p>
          <p className="text-2xl font-bold text-blue-800">{kpis.last7dSessions}</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Accuracy (rolling 4w)</p>
              <p className="text-2xl font-bold text-blue-800">{fmtPct(kpis.rolling4wAccuracyPct)}</p>
            </div>
            {/* Sparkline */}
            <div className="w-24 h-10">
              {spark.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spark}>
                    <Line type="monotone" dataKey="accPct" stroke={PALETTE.blue} strokeWidth={2} dot={false} />
                    <YAxis hide domain={[0, 100]} />
                    <XAxis hide />
                  </LineChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Progreso mixto + donut */}
      <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-blue-800 text-sm">Your Progress</h3>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
            🔥 {levelProgress}% Progress
          </span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full mb-2" aria-label="progress bar">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full" style={{ width: `${levelProgress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mb-3">
          <span>Level {activeLevel} · Sessions: {levelSessions}</span>
          <span>{levelProgress}% to next level</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-28 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={44} dataKey="value" paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<NiceTooltip mode="pct" />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-sm text-gray-600">
            <p><span className="font-semibold text-blue-700">Accuracy Level {activeLevel}:</span> {fmtPct(levelAccuracyPct)}</p>
            <p className="text-xs text-gray-500 mt-1">Progreso mixto = sesiones*3 + accuracy%*0.4 (cap 100)</p>
          </div>
        </div>
      </div>

      {/* Gráficos (sin barras) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Accuracy per Week → AreaChart */}
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Accuracy per Week</h3>
          {weeklyAccuracy.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyAccuracy}>
                <defs>
                  <linearGradient id="gAccWeek" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.blue} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PALETTE.blue} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={PALETTE.grid} strokeDasharray="3 3" />
                <XAxis dataKey="week" tickFormatter={fmtWeekStr} tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <ReferenceLine y={75} stroke={PALETTE.green} strokeDasharray="4 4" />
                <Tooltip content={<NiceTooltip mode="week" />} />
                <Area type="monotone" dataKey="accPct" stroke={PALETTE.blue} strokeWidth={2} fill="url(#gAccWeek)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No weekly accuracy yet." />}
        </div>

        {/* Accuracy by Hour → AreaChart */}
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Accuracy by Hour</h3>
          {hourlyAccuracy.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlyAccuracy}>
                <defs>
                  <linearGradient id="gAccHour" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.indigo} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PALETTE.indigo} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={PALETTE.grid} strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <ReferenceLine y={75} stroke={PALETTE.green} strokeDasharray="4 4" />
                <Tooltip content={<NiceTooltip mode="hour" />} />
                <Area type="monotone" dataKey="accPct" stroke={PALETTE.indigo} strokeWidth={2} fill="url(#gAccHour)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No hourly accuracy yet." />}
        </div>

        {/* Topic Accuracy → Radar por tema */}
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Topic Accuracy (Radar)</h3>
          {radarTopics.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarTopics}>
                <PolarGrid />
                <PolarAngleAxis dataKey="topic" tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <Radar name="Accuracy" dataKey="value" stroke={PALETTE.blue} fill={PALETTE.blueSoft} fillOpacity={0.5} />
                <Tooltip content={<NiceTooltip mode="topic" />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No topics practiced yet." />}
          <p className="text-xs text-gray-500 mt-2">Tip: trabaja primero los radios más cortos (temas con menor %).</p>
        </div>

        {/* XP Progress → dos líneas */}
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">XP Progress</h3>
          {xpWeekly.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={xpWeekly}>
                <CartesianGrid stroke={PALETTE.grid} strokeDasharray="3 3" />
                <XAxis dataKey="week" tickFormatter={fmtWeekStr} tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <Tooltip content={<NiceTooltip mode="count" />} />
                <Line type="monotone" dataKey="xp" name="XP (weekly)" stroke={PALETTE.blue} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="xpCumulative" name="XP (cumulative)" stroke={PALETTE.indigo} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No XP yet." />}
          <p className="text-xs text-gray-500 mt-2">XP = sesiones*3 + accuracy%*0.4, acumulado muestra tu tendencia.</p>
        </div>

        {/* Accuracy per Level (Radar comparativo) */}
        <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Accuracy per Level</h3>
          {radarLevelStats.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarLevelStats}>
                <PolarGrid />
                <PolarAngleAxis dataKey="level" tick={{ fill: PALETTE.gray400, fontSize: 12 }} />
                <Radar name="Accuracy" dataKey="accuracy" stroke={PALETTE.indigo} fill={PALETTE.indigoSoft} fillOpacity={0.6} />
                <Tooltip content={<NiceTooltip mode="pct" />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No level data yet." />}
        </div>
      </div>
    </div>
  );
};

export default UserStats;
