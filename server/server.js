// server/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const passport = require('passport');

const db = require('./models'); // usa models/index.js (Sequelize + modelos)
const sequelize = db.sequelize;

const app = express();

// ---------- Middlewares base ----------
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: 'http://localhost:5173', // ajusta si tu frontend cambia
  credentials: true
}));

// Si algún día corres detrás de proxy (Heroku/Render), descomenta:
// if (process.env.NODE_ENV === 'production') {
//   app.set('trust proxy', 1);
// }

// ---------- Sesiones (guardadas en MySQL con connect-session-sequelize) ----------
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'Sessions'
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 día
    httpOnly: true,
    // secure: process.env.NODE_ENV === 'production', // en prod con HTTPS
    sameSite: 'lax' // en dev está bien; en prod cross-site usa 'none' + secure:true
  }
}));

// ---------- Passport (Google OAuth) ----------
app.use(passport.initialize());
app.use(passport.session());

// ---------- Rutas ----------
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/chat'));
app.use('/api', require('./routes/userStats')); // si no la tienes, quita esta línea
app.use('/api', require('./routes/sessions'));
app.use('/api', require('./routes/tts'));

// (Opcional) ping de salud
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- Arranque ----------
(async () => {
  try {
    // 1) Conexión DB
    await sequelize.authenticate();
    console.log('✅ DB autenticada correctamente');

    // 2) Tablas del store de sesión
    await sessionStore.sync();

    // 3) Tus modelos (Users, PracticeSessions, etc.)
    await sequelize.sync();

    // 4) Servidor
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Error iniciando el servidor:', err);
    process.exit(1);
  }
})();
