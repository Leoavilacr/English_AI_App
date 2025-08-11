// server/models/User.js
const { Model, DataTypes } = require('sequelize');

class User extends Model {}

module.exports = (sequelize) => {
  User.init(
    {
      googleId: { type: DataTypes.STRING, unique: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: true },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users',
      timestamps: true,
      indexes: [{ fields: ['googleId'], unique: true }],
    }
  );
  return User;
};
