const express = require('express');
const router = express.Router();
const { PracticeSession } = require('../models');

router.get('/sessions', async (req, res) => {
  try {
    const sessions = await PracticeSession.findAll({
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'googleId',
        'level',
        'topic',
        'correct',
        'mistakes',
        'messages',
        'feedback',
        'reinforcement',
        'createdAt',
        'updatedAt'
      ]
    });

    res.json(sessions);
  } catch (err) {
    console.error('❌ Error en GET /api/sessions:', err);
    res.status(500).json({ error: 'Error retrieving sessions' });
  }
});

module.exports = router;
