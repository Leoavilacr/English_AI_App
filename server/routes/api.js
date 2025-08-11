const express = require('express');
const router = express.Router();
const { PracticeSession, ExerciseResult, ErrorLog } = require('../models');

// Middleware para asegurar que el usuario esté autenticado
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Iniciar una nueva sesión de práctica
router.post('/session/start', requireAuth, async (req, res) => {
  try {
    const session = await PracticeSession.create({
      topic: req.body.topic,
      level: req.body.level,
      correct: 0,
      mistakes: 0,
      googleId: req.user.googleId,  // 🔑 identificador del usuario
    });
    res.json(session);
  } catch (err) {
    console.error('❌ Error al crear sesión:', err);
    res.status(500).json({ error: 'Error al crear la sesión' });
  }
});

// Guardar resultado de ejercicio
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

// Guardar error detectado
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

module.exports = router;
