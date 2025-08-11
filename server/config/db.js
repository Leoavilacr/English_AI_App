// server/config/db.js
// Compatibilidad: reexporta desde models/ para evitar dos Sequelize distintos
const db = require('../models');

module.exports = {
  sequelize: db.sequelize,
  User: db.User,
  // Si necesitas otros modelos: PracticeSession, etc.
  PracticeSession: db.PracticeSession,
};
