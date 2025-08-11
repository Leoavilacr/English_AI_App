const { Model, DataTypes } = require('sequelize');

class Session extends Model {}

module.exports = (sequelize) => {
  Session.init(
    {
      topic: DataTypes.STRING,
      level: DataTypes.STRING,
      startedAt: DataTypes.DATE,
      messages: DataTypes.TEXT,         // ✅ NUEVO
      feedback: DataTypes.TEXT,         // ✅ NUEVO
      reinforcement: DataTypes.TEXT     // ✅ NUEVO
    },
    {
      sequelize,
      modelName: 'Session',
    }
  );

  return Session;
};
