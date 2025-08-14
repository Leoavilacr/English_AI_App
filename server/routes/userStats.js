// server/routes/userStats.js
const express = require('express');
const router = express.Router();
const { QueryTypes } = require('sequelize');

// 👇 Ajusta esta importación según tu estructura de proyecto
// Si usas models/index.js que exporta { sequelize }, déjalo así:
const { sequelize } = require('../models');

// Utilidades
const toPct = (num) => Math.round(num * 100);

// ----------------- Helpers de cálculo en JS -----------------
function computeStreaks(dateRows) {
  // dateRows: [{ d: '2025-08-10' }, { d: '2025-08-11' }, ...] ASC
  if (!dateRows || !dateRows.length) return { currentStreak: 0, bestStreak: 0 };

  const toDate = (s) => new Date(s + 'T00:00:00Z');
  let best = 1, current = 1;

  for (let i = 1; i < dateRows.length; i++) {
    const prev = toDate(dateRows[i - 1].d);
    const curr = toDate(dateRows[i].d);
    const diffDays = Math.round((curr - prev) / (24 * 3600 * 1000));
    if (diffDays === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }

  // currentStreak: compara el último día con hoy para ver si sigue activa la racha
  const last = toDate(dateRows[dateRows.length - 1].d);
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diffLast = Math.round((todayUTC - last) / (24 * 3600 * 1000));
  const currentStreak = diffLast <= 1 ? current : 0;

  return { currentStreak, bestStreak: best };
}

function cumulative(list, keyIn, keyOut) {
  let acc = 0;
  return list.map((row) => {
    acc += Number(row[keyIn] || 0);
    return { ...row, [keyOut]: acc };
  });
}

// ----------------- Endpoint -----------------
router.get('/:googleId', async (req, res) => {
  try {
    const { googleId } = req.params;
    const level = req.query.level || null;

    // --- Totales globales (compat) ---
    const totals = await sequelize.query(
      `
      SELECT
        SUM(correct) AS totalCorrect,
        SUM(mistakes) AS totalMistakes,
        COUNT(*) AS totalSessions
      FROM PracticeSessions
      WHERE googleId = :googleId
      `,
      { replacements: { googleId }, type: QueryTypes.SELECT }
    );
    const { totalCorrect = 0, totalMistakes = 0, totalSessions = 0 } = totals[0] || {};

    // --- Level comparative (accuracy por nivel) ---
    const levelComparative = await sequelize.query(
      `
      SELECT level,
             SUM(correct) c,
             SUM(mistakes) m,
             ROUND(SUM(correct)/NULLIF(SUM(correct)+SUM(mistakes),0), 4) AS acc
      FROM PracticeSessions
      WHERE googleId = :googleId
      GROUP BY level
      ORDER BY level
      `,
      { replacements: { googleId }, type: QueryTypes.SELECT }
    );

    // Emular levelStats (compat con front antiguo)
    const levelStats = levelComparative.map((r) => ({
      level: r.level,
      sessions: Number(r.c || 0) + Number(r.m || 0) > 0 ? Number(r.c) + Number(r.m) : 0, // aprox sesiones por sum intentos
      accuracy: Number(r.acc || 0)
    }));

    // Para progreso mixto por nivel activo
    let levelSessions = 0;
    let levelAccuracyPct = 0;
    if (level) {
      const levelAgg = await sequelize.query(
        `
        SELECT
          COUNT(*) AS sessions,
          ROUND(SUM(correct)/NULLIF(SUM(correct)+SUM(mistakes),0), 4) AS acc
        FROM PracticeSessions
        WHERE googleId = :googleId AND level = :level
        `,
        { replacements: { googleId, level }, type: QueryTypes.SELECT }
      );
      levelSessions = Number(levelAgg[0]?.sessions || 0);
      levelAccuracyPct = toPct(Number(levelAgg[0]?.acc || 0));
    }

    // --- Accuracy semanal ---
    const weeklyAcc = await sequelize.query(
      `
      SELECT YEARWEEK(createdAt, 3) AS yw,
             SUM(correct) AS c, SUM(mistakes) AS m,
             ROUND(SUM(correct)/NULLIF(SUM(correct)+SUM(mistakes),0), 4) AS acc
      FROM PracticeSessions
      WHERE googleId = :googleId
        AND (:level IS NULL OR level = :level)
      GROUP BY YEARWEEK(createdAt, 3)
      ORDER BY yw
      `,
      { replacements: { googleId, level }, type: QueryTypes.SELECT }
    );
    const weeklyAccuracy = weeklyAcc.map(r => ({ week: String(r.yw), accPct: toPct(Number(r.acc || 0)) }));

    // --- Accuracy por hora ---
    const hourlyAcc = await sequelize.query(
      `
      SELECT HOUR(createdAt) AS h,
             SUM(correct) AS c, SUM(mistakes) AS m,
             ROUND(SUM(correct)/NULLIF(SUM(correct)+SUM(mistakes),0), 4) AS acc
      FROM PracticeSessions
      WHERE googleId = :googleId
        AND (:level IS NULL OR level = :level)
      GROUP BY HOUR(createdAt)
      ORDER BY h
      `,
      { replacements: { googleId, level }, type: QueryTypes.SELECT }
    );
    const hourlyAccuracy = hourlyAcc.map(r => ({ hour: Number(r.h), accPct: toPct(Number(r.acc || 0)) }));

    // --- Accuracy por tema ---
    const topicAcc = await sequelize.query(
      `
      SELECT topic,
             SUM(correct) AS c, SUM(mistakes) AS m, COUNT(*) AS sessions,
             ROUND(SUM(correct)/NULLIF(SUM(correct)+SUM(mistakes),0), 4) AS acc
      FROM PracticeSessions
      WHERE googleId = :googleId
        AND (:level IS NULL OR level = :level)
      GROUP BY topic
      ORDER BY acc ASC, sessions DESC
      `,
      { replacements: { googleId, level }, type: QueryTypes.SELECT }
    );
    const topicAccuracy = topicAcc.map(r => ({
      topic: r.topic,
      accPct: toPct(Number(r.acc || 0)),
      sessions: Number(r.sessions || 0)
    }));

    // --- XP semanal + acumulado (progreso mixto por semana) ---
    const weeklyVol = await sequelize.query(
      `
      SELECT YEARWEEK(createdAt, 3) AS yw,
             COUNT(*) AS sessions,
             ROUND(SUM(correct)/NULLIF(SUM(correct)+SUM(mistakes),0), 4) AS acc
      FROM PracticeSessions
      WHERE googleId = :googleId
        AND (:level IS NULL OR level = :level)
      GROUP BY YEARWEEK(createdAt, 3)
      ORDER BY yw
      `,
      { replacements: { googleId, level }, type: QueryTypes.SELECT }
    );
    const xpProgressWeekly = cumulative(
      weeklyVol.map(r => {
        const accPct = toPct(Number(r.acc || 0));
        const xp = (Number(r.sessions || 0) * 3) + (accPct * 0.4);
        return { week: String(r.yw), xp: Math.round(xp) };
      }),
      'xp',
      'xpCumulative'
    );

    // --- Streaks (por días con sesiones) ---
    const days = await sequelize.query(
      `
      SELECT DATE(createdAt) AS d, COUNT(*) AS sessions
      FROM PracticeSessions
      WHERE googleId = :googleId
        AND (:level IS NULL OR level = :level)
      GROUP BY DATE(createdAt)
      ORDER BY d ASC
      `,
      { replacements: { googleId, level }, type: QueryTypes.SELECT }
    );
    const { currentStreak, bestStreak } = computeStreaks(days);

    // --- last7dSessions ---
    const last7d = await sequelize.query(
      `
      SELECT COUNT(*) AS cnt
      FROM PracticeSessions
      WHERE googleId = :googleId
        AND (:level IS NULL OR level = :level)
        AND createdAt >= (CURRENT_DATE - INTERVAL 7 DAY)
      `,
      { replacements: { googleId, level }, type: QueryTypes.SELECT }
    );
    const last7dSessions = Number(last7d[0]?.cnt || 0);

    // --- Rolling 4 weeks accuracy ---
    // Tomamos las últimas 4 semanas de weeklyAccuracy
    const rolling4 = weeklyAccuracy.slice(-4);
    const rolling4wAccuracyPct =
      rolling4.length
        ? Math.round(rolling4.reduce((s, r) => s + (r.accPct || 0), 0) / rolling4.length)
        : 0;

    // ---- Campos legacy (para no romper front viejo) ----
    // weeklyStats (volumen), hourlyStats (volumen), topicStats (volumen)
    const weeklyStats = weeklyVol.map(r => ({ week: String(r.yw), sessions: Number(r.sessions || 0), ...(level ? { level } : {}) }));
    const hourlyStats = hourlyAcc.map(r => ({ hour: Number(r.h), sessions: Number((r.c || 0) + (r.m || 0)), ...(level ? { level } : {}) }));
    const topicStats = topicAcc.map(r => ({ topic: r.topic, sessions: Number(r.sessions || 0), ...(level ? { level } : {}) }));

    // --- Respuesta final
    return res.json({
      // KPIs nuevos
      kpis: {
        currentStreak,
        bestStreak,
        last7dSessions,
        rolling4wAccuracyPct
      },
      weeklyAccuracy,     // [{week, accPct}]
      hourlyAccuracy,     // [{hour, accPct}]
      topicAccuracy,      // [{topic, accPct, sessions}]
      levelComparative,   // [{level, c, m, acc}]
      xpProgressWeekly,   // [{week, xp, xpCumulative}]

      // Compat legacy
      totalSessions: Number(totalSessions || 0),
      totalCorrect: Number(totalCorrect || 0),
      totalMistakes: Number(totalMistakes || 0),
      weeklyStats,
      hourlyStats,
      topicStats,
      levelStats,

      // Para progreso mixto por nivel actual (si se envía ?level=)
      levelSessions,
      levelAccuracyPct
    });
  } catch (err) {
    console.error('❌ /api/user-stats error', err);
    res.status(500).json({ error: 'Failed to compute user stats' });
  }
});

module.exports = router;
