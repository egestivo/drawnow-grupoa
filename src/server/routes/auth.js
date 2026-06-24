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

// Ruta que el frontend dispara para ir a logearse a Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// Callback a donde Google redirige al usuario con el resultado
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    // Al autenticarse con éxito, req.user tiene los datos del usuario de la BD
    const payload = { id: req.user._id, username: req.user.username };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'drawnow_auth_secret_dev', {
      expiresIn: '12h'
    });
    
    // EFECTUAR REDIRECCIÓN: Mandamos el token y el usuario directo a la app principal por la URL
    res.redirect(`/?token=${token}&username=${encodeURIComponent(req.user.username)}`);
  }
);

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

/**
 * POST /api/auth/forgot-password
 * Genera un token JWT de corta duración para restablecer la contraseña.
 * Retorna el enlace directamente (sin email, modo demo/universitario).
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario es requerido.' });
    }

    const user = await Usuario.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No existe ninguna cuenta con ese nombre de usuario.' });
    }

    // Los usuarios de Google no tienen contraseña local
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Esta cuenta fue creada con Google. Inicia sesión con Google directamente.'
      });
    }

    // Generar token JWT de un solo uso con expiración de 15 minutos
    const payload = { id: user._id, username: user.username, type: 'password-reset' };
    const resetToken = jwt.sign(payload, process.env.JWT_SECRET || 'drawnow_auth_secret_dev', {
      expiresIn: '15m'
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    res.json({
      success: true,
      message: 'Enlace de recuperación generado correctamente. Válido por 15 minutos.',
      resetLink
    });
  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Valida el token JWT de recuperación y actualiza la contraseña del usuario.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token y nueva contraseña son requeridos.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Verificar y decodificar el JWT
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'drawnow_auth_secret_dev');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'El enlace de recuperación ha expirado. Solicita uno nuevo.' });
      }
      return res.status(401).json({ success: false, message: 'Token inválido o manipulado.' });
    }

    // Validar que sea un token de tipo password-reset
    if (payload.type !== 'password-reset') {
      return res.status(401).json({ success: false, message: 'Token no válido para esta operación.' });
    }

    // Buscar al usuario y actualizar la contraseña
    const user = await Usuario.findById(payload.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: '¡Contraseña actualizada correctamente! Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

module.exports = router;