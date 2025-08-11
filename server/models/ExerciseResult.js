const { Model, DataTypes } = require('sequelize');

class ExerciseResult extends Model {}

module.exports = (sequelize) => {
  ExerciseResult.init(
    {
      question: DataTypes.TEXT,
      userAnswer: DataTypes.TEXT,
      isCorrect: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: 'ExerciseResult',
    }
  );

  return ExerciseResult;
};
