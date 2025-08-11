const { Model, DataTypes } = require('sequelize');

class ErrorLog extends Model {}

module.exports = (sequelize) => {
  ErrorLog.init(
    {
      message: DataTypes.STRING,
      stack: DataTypes.TEXT,
      timestamp: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ErrorLog',
    }
  );

  return ErrorLog;
};
