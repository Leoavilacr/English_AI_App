const { sequelize } = require('../config/db');
const { Sequelize, DataTypes } = require('sequelize');

const User = require('./User')(sequelize);
const Session = require('./Session')(sequelize);
const PracticeSession = require('./practiceSession')(sequelize);
const ExerciseResult = require('./ExerciseResult')(sequelize);
const ErrorLog = require('./ErrorLog')(sequelize);

const db = {
  Sequelize,
  sequelize,
  User,
  Session,
  PracticeSession,
  ExerciseResult,
  ErrorLog,
};

// Asociaciones
User.hasMany(Session);
Session.belongsTo(User);

User.hasMany(ExerciseResult);
ExerciseResult.belongsTo(User);

User.hasMany(ErrorLog);
ErrorLog.belongsTo(User);

// En el futuro se puede asociar PracticeSession

module.exports = db;
