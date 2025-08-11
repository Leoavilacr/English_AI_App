// server/models/index.js
'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const basename = path.basename(__filename);

// Lee credenciales desde .env
const DB_NAME = process.env.DB_NAME || 'english_ai_app';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS ?? process.env.DB_PASSWORD ?? '';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_DIALECT = process.env.DB_DIALECT || 'mysql';
const DB_LOGGING = (process.env.DB_LOGGING || 'true').toLowerCase() === 'true';

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: DB_DIALECT,
  logging: DB_LOGGING ? (sql) => console.log(sql) : false,
});

const db = {};

// Carga automática de modelos, evitando Session/Sessions por conflicto con express-session
fs
  .readdirSync(__dirname)
  .filter(file =>
    file.indexOf('.') !== 0 &&
    file !== basename &&
    file.endsWith('.js') &&
    file.toLowerCase() !== 'session.js' &&
    file.toLowerCase() !== 'sessions.js'
  )
  .forEach(file => {
    const defineModel = require(path.join(__dirname, file));
    const model = defineModel(sequelize, DataTypes);
    db[model.name] = model; // p.ej. PracticeSession, User, ...
  });

// Relaciones (si las agregas en el futuro)
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) db[modelName].associate(db);
});

// Diagnóstico: ver qué modelos cargaron
const loaded = Object.keys(db).filter(k => !['sequelize', 'Sequelize'].includes(k));
console.log('[models] Loaded:', loaded);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
