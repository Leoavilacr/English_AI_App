const { Model, DataTypes } = require('sequelize');

class User extends Model {}

module.exports = (sequelize) => {
  User.init(
    {
      googleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: DataTypes.STRING,
      email: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'User',
    }
  );

  return User;
};
