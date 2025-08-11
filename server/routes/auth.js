const express = require('express');
const passport = require('passport');
const router = express.Router();

// Iniciar autenticación con Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback de Google
router.get(
  '/google/callback',
  passport.authenticate('google', {
    successRedirect: 'http://localhost:5173/menu',
    failureRedirect: '/',
  })
);

// Cerrar sesión
router.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.redirect('/');
  });
});

// ✅ Obtener el usuario autenticado
router.get('/user', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;
