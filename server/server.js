const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const cors = require('cors');
const { sequelize } = require('./config/db');
require('dotenv').config();
require('./config/passport');

// 🧩 Rutas
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const apiRoutes = require('./routes/api');
const userStatsRoutes = require('./routes/userStats');
const sessionViewerRoutes = require('./routes/sessions'); // ✅ nueva ruta añadida

const app = express();

// 🛡️ CORS para frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// 🧠 Parsear JSON
app.use(express.json());

// ===== Google TTS (REST via API key) =====
// Requiere Node 18+ (tiene fetch global). Si usas Node < 18:
//   npm i node-fetch
//   const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_TTS_VOICE = 'en-US-Neural2-C'; // puedes sobreescribirlo desde el frontend

function resolveTtsApiKey() {
  // Soporta ambas convenciones por compatibilidad
  return process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_TTS_API;
}

async function synthesizeWithGoogle(text, voiceName, { rate, pitch } = {}) {
  const apiKey = resolveTtsApiKey();
  if (!apiKey) {
    throw new Error('Missing GOOGLE_TTS_API_KEY (or GOOGLE_TTS_API) in .env');
  }

  // Determina el languageCode según la voz solicitada
  const languageCode = voiceName?.startsWith('en-GB') ? 'en-GB' : 'en-US';

  const body = {
    input: { text },
    voice: {
      languageCode,
      name: voiceName || DEFAULT_TTS_VOICE,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: typeof rate === 'number' ? rate : 0.95,
      pitch: typeof pitch === 'number' ? pitch : 0.0,
    },
  };

  const res = await fetch(`${TTS_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Google TTS error ${res.status}: ${errTxt}`);
  }

  const json = await res.json();
  if (!json.audioContent) {
    throw new Error('No audioContent in Google TTS response.');
  }
  return Buffer.from(json.audioContent, 'base64');
}

async function ttsHandler(req, res) {
  try {
    const { text, voice, rate, pitch } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }

    // Evita payloads gigantes por accidente
    const safeText = text.length > 5000 ? text.slice(0, 5000) : text;

    const mp3Buffer = await synthesizeWithGoogle(safeText, voice, { rate, pitch });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(mp3Buffer);
  } catch (err) {
    console.error('🔴 /api/tts error:', err);
    return res.status(500).json({ error: 'TTS failed', detail: String(err?.message || err) });
  }
}

// Endpoints (oficial + alias)
app.post('/api/tts', ttsHandler);
app.post('/api/tss', ttsHandler);


// 🔐 Configurar sesiones con almacenamiento en MySQL
const sessionStore = new SequelizeStore({ db: sequelize });
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore
}));
sessionStore.sync();

// 🔑 Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// 📌 Rutas principales
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user-stats', userStatsRoutes);
app.use('/api', sessionViewerRoutes); // ✅ nueva ruta para sesiones

// 🔃 Cargar relaciones entre modelos
require('./models');

// 🚀 Iniciar el servidor
const PORT = process.env.PORT || 3001;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
  });
});
