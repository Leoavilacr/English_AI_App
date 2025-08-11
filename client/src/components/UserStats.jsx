import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#3B82F6', '#93C5FD', '#8B5CF6', '#34D399', '#F59E0B', '#F87171', '#6366F1', '#F43F5E'];

const UserStats = ({ googleId }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('⏰ Fetch ejecutado a:', new Date().toISOString());
        if (!googleId) return;
        const encodedId = encodeURIComponent(String(googleId));
        const res = await fetch(`/api/user-stats/${encodedId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch stats');
        const json = await res.json();
        console.log('📊 Datos recibidos del backend:', json);
        setStats(json);
      } catch (err) {
        console.error('❌ Error loading stats:', err);
      }
    };

    fetchStats();
  }, [googleId]);

  if (!stats) return <p className="text-sm text-gray-500">Loading progress...</p>;

  const {
    level = 'A1',
    accuracy = 0,
    totalSessions = 0,
    correctAnswers = 0,
    mistakes = 0,
    levelProgress = 0,
    sessionsPerDay = [],
    weeklyStats = [],
    levelStats = [],
    hourlyStats = [],
    topicStats = []
  } = stats;

  const pieData = [
    { name: 'Correct Answers', value: correctAnswers },
    { name: 'Mistakes', value: mistakes }
  ];

  return (
    <div className="space-y-6">
      {/* Nivel + progreso */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-bold text-blue-800 text-sm mb-1">Your Progress</h3>
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm text-blue-600 font-medium">Level {level}</p>
          {totalSessions >= 20 && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">🔥 20+ Sessions</span>
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
          <p className="text-3xl font-bold text-blue-800">{accuracy}%</p>
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
        </div>

        {/* Sessions per Day */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Sessions per Day</h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={sessionsPerDay}>
              <XAxis dataKey="day" />
              <YAxis hide />
              <Tooltip />
              <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly performance */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Correct vs Mistakes per Week</h3>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={weeklyStats}>
              <XAxis dataKey="week" />
              <Tooltip />
              <Area type="monotone" dataKey="correct" stackId="1" stroke="#34D399" fill="#A7F3D0" />
              <Area type="monotone" dataKey="mistakes" stackId="1" stroke="#F87171" fill="#FECACA" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Accuracy per level */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Accuracy per Level</h3>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={levelStats}>
              <PolarGrid />
              <PolarAngleAxis dataKey="level" />
              <Radar name="Accuracy" dataKey="accuracy" stroke="#6366F1" fill="#6366F1" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly stats */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Sessions by Hour</h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={hourlyStats}>
              <XAxis dataKey="hour" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="#DBEAFE"
                fillOpacity={0.3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Topic stats */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-blue-700 text-sm mb-2">Sessions by Topic</h3>
          {topicStats.length > 0 ? (
            <>
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topicStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="topic"
                    >
                      {topicStats.map((entry, index) => (
                        <Cell key={`cell-topic-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center text-xs text-gray-500 mt-2">
                {topicStats.map((entry, index) => (
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
