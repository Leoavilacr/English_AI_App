const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const { Op } = require('sequelize');

router.get('/', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await Session.sync();
  const sessions = await Session.findAll({ where: { userId: req.user.id } });

  const total = sessions.length;

  const byLevel = {};
  const byTopic = {};
  const byDate = {};

  sessions.forEach(s => {
    byLevel[s.level] = (byLevel[s.level] || 0) + 1;
    byTopic[s.topic] = (byTopic[s.topic] || 0) + 1;

    const date = new Date(s.createdAt).toISOString().slice(0, 10);
    byDate[date] = (byDate[date] || 0) + 1;
  });

  res.json({ total, byLevel, byTopic, byDate });
});

module.exports = router;