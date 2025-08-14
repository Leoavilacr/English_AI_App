// server/routes/api.js
const express = require('express');
const router = express.Router();
const { PracticeSession, ExerciseResult, ErrorLog } = require('../models');

// --- Seguridad: requiere sesión iniciada ---
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// --- Diagnóstico rápido ---
// GET /api/ping -> 200 si el router está montado; user:true si hay sesión
router.get('/ping', (req, res) => {
  res.json({ ok: true, user: !!req.user });
});

// --- Iniciar nueva sesión de práctica ---
router.post('/session/start', requireAuth, async (req, res) => {
  try {
    const session = await PracticeSession.create({
      topic: req.body.topic,
      level: req.body.level,
      correct: 0,
      mistakes: 0,
      googleId: req.user.googleId, // 🔑 usuario dueño
      messages: '[]',
      feedback: '',
      reinforcement: ''
    });
    res.json(session);
  } catch (err) {
    console.error('❌ Error al crear sesión:', err);
    res.status(500).json({ error: 'Error al crear la sesión' });
  }
});

// --- Guardar resultado de ejercicio ---
router.post('/exercise/result', requireAuth, async (req, res) => {
  try {
    const result = await ExerciseResult.create({
      ...req.body,
      UserId: req.user.id,
    });
    res.json(result);
  } catch (err) {
    console.error('❌ Error al guardar resultado:', err);
    res.status(500).json({ error: 'Error al guardar resultado' });
  }
});

// --- Guardar error detectado ---
router.post('/error', requireAuth, async (req, res) => {
  try {
    const error = await ErrorLog.create({
      ...req.body,
      timestamp: new Date(),
      UserId: req.user.id,
    });
    res.json(error);
  } catch (err) {
    console.error('❌ Error al guardar error:', err);
    res.status(500).json({ error: 'Error al guardar error' });
  }
});

// --- LISTAR SESIONES (endpoint nuevo) ---
// GET /api/sessionViewer?limit=50&offset=0
router.get('/sessionViewer', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);

    const rows = await PracticeSession.findAll({
      where: { googleId: req.user.googleId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json(rows);
  } catch (err) {
    console.error('❌ Error al cargar sessionViewer:', err);
    res.status(500).json({ error: 'Error al cargar las sesiones' });
  }
});

// --- ALIAS COMPATIBILIDAD (/api/sessions) ---
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);

    const rows = await PracticeSession.findAll({
      where: { googleId: req.user.googleId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json(rows);
  } catch (err) {
    console.error('❌ Error al cargar sessions:', err);
    res.status(500).json({ error: 'Error al cargar las sesiones' });
  }
});

// --- OBTENER UNA SESIÓN POR ID (opcional) ---
// GET /api/sessionViewer/:id
router.get('/sessionViewer/:id', requireAuth, async (req, res) => {
  try {
    const item = await PracticeSession.findByPk(req.params.id);
    if (!item || item.googleId !== req.user.googleId) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    res.json(item);
  } catch (err) {
    console.error('❌ Error al cargar sesión:', err);
    res.status(500).json({ error: 'Error al cargar la sesión' });
  }
});

module.exports = router;
