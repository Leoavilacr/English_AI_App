const express = require('express');
const router = express.Router();
const { PracticeSession } = require('../models');
const { Op } = require('sequelize');

const getWeekday = (dateStr) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateStr).getDay()];
};

const getWeekRange = (date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

router.get('/test', (req, res) => {
  res.send('✅ userStats.js está funcionando');
});

router.get('/:googleId', async (req, res) => {
  try {
    const { googleId } = req.params;
    console.log("📥 Recibido googleId:", googleId);

    const sessions = await PracticeSession.findAll({
      where: { googleId },
      order: [['createdAt', 'DESC']],
    });

    if (!sessions.length) {
      return res.json({
        level: 'A1',
        accuracy: 0,
        totalSessions: 0,
        correctAnswers: 0,
        mistakes: 0,
        levelProgress: 0,
        sessionsPerDay: [],
        weeklyStats: [],
        levelStats: [],
        hourlyStats: [],
        topicStats: []
      });
    }

    const totalSessions = sessions.length;
    const correctAnswers = sessions.reduce((sum, s) => sum + s.correct, 0);
    const mistakes = sessions.reduce((sum, s) => sum + s.mistakes, 0);
    const accuracy = correctAnswers + mistakes > 0
      ? Math.round((correctAnswers * 100) / (correctAnswers + mistakes))
      : 0;

    const mostRecent = sessions[0];
    const level = mostRecent.level;
    const levelProgress = Math.min(100, Math.round((totalSessions / 20) * 100));

    const sessionsPerDayMap = {};
    const levelMap = {};
    const hourlyMap = {};
    const topicMap = {};
    const weekMap = {};

    sessions.forEach(s => {
      console.log('🧪 Sesión:', s.toJSON()); // 👈 log del contenido completo de cada sesión

      const day = getWeekday(s.createdAt);
      sessionsPerDayMap[day] = (sessionsPerDayMap[day] || 0) + 1;

      // Por nivel
      if (!levelMap[s.level]) levelMap[s.level] = { correct: 0, total: 0 };
      levelMap[s.level].correct += s.correct;
      levelMap[s.level].total += s.correct + s.mistakes;

      // Por hora
      const hour = new Date(s.createdAt).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;

      // Por tema
      if (s.topic) {
        topicMap[s.topic] = (topicMap[s.topic] || 0) + 1;
      }

      // Por semana
      const weekKey = getWeekRange(s.createdAt);
      if (!weekMap[weekKey]) weekMap[weekKey] = { correct: 0, mistakes: 0 };
      weekMap[weekKey].correct += s.correct;
      weekMap[weekKey].mistakes += s.mistakes;
    });

    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const sessionsPerDay = allDays.map(day => ({
      day,
      sessions: sessionsPerDayMap[day] || 0,
    }));

    const levelStats = Object.keys(levelMap).map(level => ({
      level,
      accuracy: levelMap[level].total > 0 ? Math.round((levelMap[level].correct * 100) / levelMap[level].total) : 0
    }));

    const hourlyStats = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}:00`,
      sessions: hourlyMap[h] || 0
    }));

    const topicStats = Object.keys(topicMap).map(topic => ({ topic, count: topicMap[topic] }));

    const weeklyStats = Object.keys(weekMap).map(week => ({
      week,
      correct: weekMap[week].correct,
      mistakes: weekMap[week].mistakes
    }));

    res.json({
      level,
      accuracy,
      totalSessions,
      correctAnswers,
      mistakes,
      levelProgress,
      sessionsPerDay,
      weeklyStats,
      levelStats,
      hourlyStats,
      topicStats
    });
  } catch (err) {
    console.error('❌ Error en /user-stats:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
