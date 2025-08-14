// server/models/practiceSession.js
module.exports = (sequelize, DataTypes) => {
  const PracticeSession = sequelize.define('PracticeSession', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    googleId: { type: DataTypes.STRING(50), allowNull: false },
    level: { type: DataTypes.STRING(5), allowNull: false },
    topic: { type: DataTypes.STRING(100) },
    correct: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    mistakes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    messages: { type: DataTypes.TEXT },
    feedback: { type: DataTypes.TEXT },
    reinforcement: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
  }, {
    tableName: 'PracticeSessions',
    indexes: [
      { fields: ['googleId'], name: 'practice_sessions_google_id' },
      { fields: ['createdAt'], name: 'practice_sessions_created_at' }
    ]
  });

  return PracticeSession;
};
