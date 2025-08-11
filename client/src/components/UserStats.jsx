// UserStats.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#3B82F6', '#93C5FD', '#8B5CF6', '#34D399', '#F59E0B', '#F87171', '#6366F1', '#F43F5E'];

// Usa VITE_API_BASE si existe; si no, llama directo al backend local para evitar 404 sin proxy
const API_BASE = (import.meta.env?.VITE_API_BASE ?? 'http://localhost:3001');

const UserStats = ({ googleId }) => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let aborted = false;

    const fetchStats = async () => {
      try {
        setError('');
        if (!googleId) return;
        const encodedId = encodeURIComponent(String(googleId));
        const res = await fetch(`${API_BASE}/api/user-stats/${encodedId}`, { credentials: 'include' });
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
  }, [googleId]);

  // Derivados para UI (mapean lo que entrega el backend a lo que necesita el UI)
  const derived = useMemo(() => {
    if (!stats) return null;

    const {
      totalSessions = 0,
      totalCorrect = 0,
      totalMistakes = 0,
      weeklyStats = [],      // [{ week: '2025-30', sessions: 3 }]
      levelStats = [],       // [{ level:'A1', sessions: n, accuracy: 0..1 }]
      hourlyStats = [],      // [{ hour: 13, sessions: 2 }]
      topicStats = []        // [{ topic:'travel', sessions: 5 }]
    } = stats;

    const attempts = totalCorrect + totalMistakes;
    const accuracyPct = attempts > 0 ? Math.round((totalCorrect / attempts) * 100) : 0;

    // Nivel más practicado
    const topLevel = levelStats.length
      ? levelStats.reduce((a, b) => (b.sessions > a.sessions ? b : a)).level
      : 'A1';

    // Progreso “gamificado” hacia siguiente nivel (heurística simple por nº de sesiones)
    const levelProgress = totalSessions > 0 ? Math.min(100, Math.round((totalSessions % 20) * (100 / 20))) : 0;

    // Sessions por semana para line chart
    const sessionsPerWeek = weeklyStats.map(w => ({ week: w.week, sessions: w.sessions || 0 }));

    // Accuracy por nivel en %
    const radarLevelStats = levelStats.map(x => ({
      level: x.level,
      accuracy: Math.round((x.accuracy || 0) * 100)
    }));

    // Topic stats: usa `sessions` (no `count`)
    const pieTopics = topicStats.map(t => ({ topic: t.topic, sessions: t.sessions || 0 }));

    return {
      totalSessions,
      totalCorrect,
      totalMistakes,
      accuracyPct,
      topLevel,
      levelProgress,
      sessionsPerWeek,
      radarLevelStats,
      hourlyStats,
      pieTopics
    };
  }, [stats]);

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (!derived) {
    return <p className="text-sm text-gray-500">Loading progress...</p>;
  }

  const {
    totalSessions,
    totalCorrect,
    totalMistakes,
    accuracyPct,
    topLevel,
    levelProgress,
    sessionsPerWeek,
    radarLevelStats,
    hourlyStats,
    pieTopics
  } = derived;

  const pieData = [
    { name: 'Correct Answers', value: totalCorrect },
    { name: 'Mistakes', value: totalMistakes }
  ];

  return (
    <div className="space-y-6">
      {/* Nivel + progreso */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-bold text-blue-800 text-sm mb-1">Your Progress</h3>
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm text-blue-600 font-medium">Level {topLevel}</p>
          {totalSessions >= 20 && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">🔥 {totalSessions} Sessions</span>
          )}
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full mb-1">
          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${levelProgress}%` }} />
        </div>
        <p className="text-xs text-right text-gray-400">{levelProgress}% to next level</p>
      </div>

      {/* Gráficos en grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Accuracy */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold text-blue-800">{accuracyPct}%</p>
          <p className="text-sm text-gray-600 mb-2">Accuracy</p>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%" innerRadius={25} outerRadius={40}
                dataKey="value" paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">
            Attempts: {totalCorrect + totalMistakes} &middot; Sessions: {totalSessions}
          </p>
        </div>

        {/* Sessions per Week */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Sessions per Week</h3>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={sessionsPerWeek}>
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Accuracy per level */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Accuracy per Level</h3>
          {radarLevelStats.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarLevelStats}>
                <PolarGrid />
                <PolarAngleAxis dataKey="level" />
                <Radar name="Accuracy" dataKey="accuracy" stroke="#6366F1" fill="#6366F1" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 italic">No level data yet.</p>
          )}
        </div>

        {/* Hourly stats */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Sessions by Hour</h3>
          {hourlyStats.length ? (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={hourlyStats}>
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 italic">No hourly data yet.</p>
          )}
        </div>

        {/* Topic stats */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Sessions by Topic</h3>
          {pieTopics.length > 0 ? (
            <>
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieTopics}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="sessions"
                      nameKey="topic"
                    >
                      {pieTopics.map((entry, index) => (
                        <Cell key={`cell-topic-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center text-xs text-gray-500 mt-2">
                {pieTopics.map((entry, index) => (
                  <span key={index} className="mr-3">
                    <span style={{ color: COLORS[index % COLORS.length] }}>●</span> {entry.topic}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No topic data available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserStats;
