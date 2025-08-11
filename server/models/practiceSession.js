const { Model, DataTypes } = require('sequelize');

class PracticeSession extends Model {}

module.exports = (sequelize) => {
  PracticeSession.init(
    {
      googleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      level: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: true, // ✅ importante para que no falle si topic es null
      },
      correct: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      mistakes: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'PracticeSession',
      timestamps: true, // ✅ asegura que createdAt y updatedAt funcionen
    }
  );

  return PracticeSession;
};
