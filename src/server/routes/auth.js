const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const Usuario = require('../models/Usuario');

// ==========================================
// REGISTRO TRADICIONAL
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos.' });
    }

    const existingUser = await Usuario.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya está en uso.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new Usuario({
      username,
      password: hashedPassword
    });

    await newUser.save();
    res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

// ==========================================
// LOGIN TRADICIONAL
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos.' });
    }

    const user = await Usuario.findOne({ username });
    if (!user || !user.password) {
      return res.status(404).json({ success: false, message: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Credenciales inválidas.' });
    }

    const payload = { id: user._id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'drawnow_auth_secret_dev', {
      expiresIn: '12h'
    });

    res.json({
      success: true,
      token,
      user: { username: user.username }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

// ==========================================
// RUTAS NUEVAS: OAUTH 2.0 (GOOGLE)
// ==========================================

// 1. Ruta que el frontend dispara para ir a logearse a Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// 2. Callback a donde Google redirige al usuario con el resultado
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login.html', session: false }),
  (req, res) => {
    // Al autenticarse con éxito, req.user tiene los datos del usuario de la BD
    const payload = { id: req.user._id, username: req.user.username };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'drawnow_auth_secret_dev', {
      expiresIn: '12h'
    });

    // Redirigimos al frontend pasándole el JWT y el username en la URL
    res.redirect(`/index.html?token=${token}&username=${encodeURIComponent(req.user.username)}`);
  }
);

module.exports = router;