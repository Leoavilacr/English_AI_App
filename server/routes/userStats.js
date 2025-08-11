// server/routes/userStats.js
const express = require('express');
const router = express.Router();
const models = require('../models');
const PracticeSession = models?.PracticeSession;

// --- util: semana ISO YYYY-WW (tolerante a fechas raras) ---
function weekKey(d) {
  const base = d ? new Date(d) : new Date();
  if (isNaN(base.getTime())) return '0000-00';
  const tmp = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  const y = tmp.getUTCFullYear();
  return `${y}-${String(weekNo).padStart(2, '0')}`;
}

// --- ping rápido para verificar montaje ---
router.get('/user-stats/ping', (_req, res) => {
  res.json({ ok: true, hasModel: !!PracticeSession });
});

// Soportamos varias rutas por compatibilidad:
//  /api/user-stats/:googleId   (oficial)
//  /api/userstats/:googleId    (alias)
//  /api/user/:googleId         (alias viejo)
router.get(['/user-stats/:googleId', '/userstats/:googleId', '/user/:googleId'], async (req, res) => {
  try {
    if (!PracticeSession || !PracticeSession.findAll) {
      console.error('[user-stats] PracticeSession model not loaded. models keys:', Object.keys(models || {}));
      return res.status(500).json({ error: 'PracticeSession model not loaded' });
    }

    const googleId = String(req.params.googleId || '').trim();
    if (!googleId) return res.status(400).json({ error: 'Missing googleId' });

    console.log('[user-stats] GET → googleId:', googleId);

    const sessions = await PracticeSession.findAll({
      where: { googleId },
      order: [['createdAt', 'DESC']]
    });

    const totalSessions = sessions.length;
    const totalCorrect  = sessions.reduce((a, s) => a + (Number(s.correct)   || 0), 0);
    const totalMistakes = sessions.reduce((a, s) => a + (Number(s.mistakes) || 0), 0);

    // weeklyStats
    const weeklyMap = new Map();
    sessions.forEach(s => {
      const k = weekKey(s.createdAt || s.updatedAt);
      weeklyMap.set(k, (weeklyMap.get(k) || 0) + 1);
    });
    const weeklyStats = Array.from(weeklyMap.entries())
      .map(([week, count]) => ({ week, sessions: count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // levelStats
    const levelAgg = new Map();
    sessions.forEach(s => {
      const lvl = s.level || 'Unknown';
      const agg = levelAgg.get(lvl) || { level: lvl, correct: 0, mistakes: 0, sessions: 0 };
      agg.correct  += (Number(s.correct) || 0);
      agg.mistakes += (Number(s.mistakes) || 0);
      agg.sessions += 1;
      levelAgg.set(lvl, agg);
    });
    const levelStats = Array.from(levelAgg.values()).map(x => ({
      level: x.level,
      sessions: x.sessions,
      accuracy: x.correct + x.mistakes > 0 ? x.correct / (x.correct + x.mistakes) : 0
    }));

    // hourlyStats
    const hourMap = new Map();
    sessions.forEach(s => {
      const created = new Date(s.createdAt || s.updatedAt || Date.now());
      const h = isNaN(created.getTime()) ? 0 : created.getHours();
      hourMap.set(h, (hourMap.get(h) || 0) + 1);
    });
    const hourlyStats = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, sessions: count }))
      .sort((a, b) => a.hour - b.hour);

    // topicStats
    const topicMap = new Map();
    sessions.forEach(s => {
      const t = (s.topic || 'unknown').trim();
      topicMap.set(t, (topicMap.get(t) || 0) + 1);
    });
    const topicStats = Array.from(topicMap.entries())
      .map(([topic, count]) => ({ topic, sessions: count }))
      .sort((a, b) => b.sessions - a.sessions);

    res.json({
      totalSessions,
      totalCorrect,
      totalMistakes,
      weeklyStats,
      levelStats,
      hourlyStats,
      topicStats
    });
  } catch (err) {
    // Log hiper detallado para ver el error real
    console.error('[user-stats] GET error →', err?.message);
    console.error(err?.stack || err);
    res.status(500).json({ error: 'Failed to load stats', detail: err?.message || String(err) });
  }
});

// (Opcional) endpoint para registrar/actualizar una práctica rápidamente
router.post('/user-stats/update', async (req, res) => {
  try {
    if (!PracticeSession || !PracticeSession.create) {
      return res.status(500).json({ error: 'PracticeSession model not loaded' });
    }
    const { googleId, level, topic, correct = 0, mistakes = 0 } = req.body || {};
    if (!googleId || !level || !topic) {
      return res.status(400).json({ error: 'Missing fields (googleId, level, topic)' });
    }
    const row = await PracticeSession.create({
      googleId: String(googleId),
      level,
      topic,
      correct: Number(correct) || 0,
      mistakes: Number(mistakes) || 0
    });
    res.json({ ok: true, id: row.id });
  } catch (err) {
    console.error('[user-stats] POST error →', err?.message);
    res.status(500).json({ error: 'Failed to update stats', detail: err?.message });
  }
});

module.exports = router;
