// server/routes/sessions.js
const express = require('express');
const router = express.Router();
const models = require('../models');

const PracticeSession =
  models.PracticeSession ||
  models.PracticeSessions ||
  models['PracticeSession'];

router.get('/practice-sessions/ping', (_req, res) => {
  const keys = Object.keys(models || {});
  res.json({ ok: true, loadedModels: keys, hasPracticeSession: !!PracticeSession });
});

router.get('/practice-sessions/:googleId', async (req, res) => {
  try {
    if (!PracticeSession || !PracticeSession.findAll) {
      console.error('[practice-sessions] PracticeSession model NOT loaded. models keys:', Object.keys(models || {}));
      return res.status(500).json({ error: 'PracticeSession model not loaded' });
    }

    const googleId = String(req.params.googleId || '').trim();
    if (!googleId) return res.status(400).json({ error: 'Missing googleId' });

    console.log('[practice-sessions] GET → googleId:', googleId);

    const items = await PracticeSession.findAll({
      where: { googleId },
      order: [['createdAt', 'DESC']],
      limit: 50
      // ⬆️ No usamos startedAt
    });

    res.json({ items });
  } catch (err) {
    console.error('[practice-sessions] GET error →', err?.message);
    console.error(err?.stack || err);
    res.status(500).json({ error: 'Failed to load practice sessions', detail: err?.message || String(err) });
  }
});

router.post('/practice-sessions', async (req, res) => {
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
      // ⬆️ Sin startedAt
    });

    res.json({ ok: true, id: row.id });
  } catch (err) {
    console.error('[practice-sessions] POST error →', err?.message);
    res.status(500).json({ error: 'Failed to create practice session', detail: err?.message });
  }
});

module.exports = router;
