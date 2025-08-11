// server/models/PracticeSession.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize, InjectedTypes) => {
  const DT = InjectedTypes || DataTypes;

  const PracticeSession = sequelize.define('PracticeSession', {
    id:        { type: DT.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    googleId:  { type: DT.STRING, allowNull: false },
    level:     { type: DT.STRING(8), allowNull: false },
    topic:     { type: DT.STRING(64), allowNull: false },
    correct:   { type: DT.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    mistakes:  { type: DT.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }
    // ⬆️ Sin startedAt
  }, {
    tableName: 'PracticeSessions',
    timestamps: true,
    indexes: [{ fields: ['googleId'] }, { fields: ['createdAt'] }]
  });

  return PracticeSession;
};
