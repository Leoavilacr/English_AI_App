// server/routes/auth.js
const express = require('express');
const router = express.Router();

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const { User } = require('../models');

// ---------- Passport: serialize / deserialize ----------
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const u = await User.findByPk(id);
    done(null, u);
  } catch (e) {
    done(e);
  }
});

// ---------- Google OAuth2 Strategy ----------
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL = 'http://localhost:3001/auth/google/callback',
  POST_LOGIN_REDIRECT = 'http://localhost:5173/'
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('[auth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
}

passport.use(new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID || '',
    clientSecret: GOOGLE_CLIENT_SECRET || '',
    callbackURL: GOOGLE_CALLBACK_URL
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const name = profile.displayName || 'Google User';
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

      const [user] = await User.findOrCreate({
        where: { googleId },
        defaults: { name, email }
      });

      // Actualiza si cambian nombre/email en Google
      let needSave = false;
      if (user.name !== name) { user.name = name; needSave = true; }
      if (email && user.email !== email) { user.email = email; needSave = true; }
      if (needSave) await user.save();

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// ---------- Rutas de autenticación ----------
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login-failed', session: true }),
  (req, res) => {
    // Redirige al frontend después de login OK
    res.redirect(POST_LOGIN_REDIRECT);
  }
);

router.get('/login-failed', (_req, res) => {
  res.status(401).json({ error: 'Login failed' });
});

router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

// Usuario autenticado (o null)
router.get('/me', (req, res) => {
  if (!req.user) return res.status(200).json(null);
  res.json({
    id: req.user.id,
    googleId: req.user.googleId,
    name: req.user.name,
    email: req.user.email
  });
});

// Alias de compatibilidad si el frontend aún llama a /auth/user
router.get('/user', (req, res) => {
  if (!req.user) return res.status(200).json(null);
  res.json({
    id: req.user.id,
    googleId: req.user.googleId,
    name: req.user.name,
    email: req.user.email
  });
});

module.exports = router;
