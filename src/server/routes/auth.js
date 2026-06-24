const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const Usuario = require('../models/Usuario');
const logger = require('../logs/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'drawnow_auth_secret_dev';

// ==========================================
// REGISTRO TRADICIONAL
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      logger.warn('Registro fallido: campos incompletos - user=' + (username || 'vacio'), { category: 'auth' });
      return res.status(400).json({ success: false, message: 'Usuario, correo y contraseña son requeridos.' });
    }

    const existingUser = await Usuario.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      logger.warn('Registro fallido: usuario o correo ya existe - user=' + username + ' email=' + email, { category: 'auth' });
      return res.status(400).json({ success: false, message: 'El nombre de usuario o correo ya está en uso.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new Usuario({ username, email, password: hashedPassword });
    await newUser.save();
    logger.info('Usuario registrado exitosamente - user=' + username + ' email=' + email, { category: 'auth' });
    res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    logger.error('Error en registro: ' + error.message, { category: 'auth' });
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
      logger.warn('Login fallido: campos incompletos - user=' + (username || 'vacio'), { category: 'auth' });
      return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos.' });
    }

    const user = await Usuario.findOne({ username });
    if (!user || !user.password) {
      logger.warn('Login fallido: usuario no encontrado - user=' + username, { category: 'auth' });
      return res.status(404).json({ success: false, message: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn('Login fallido: contraseña incorrecta - user=' + username, { category: 'auth' });
      return res.status(400).json({ success: false, message: 'Credenciales inválidas.' });
    }

    const payload = { id: user._id, username: user.username };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    logger.info('Login exitoso - user=' + username, { category: 'auth' });
    res.json({ success: true, token, user: { username: user.username } });
  } catch (error) {
    logger.error('Error en login: ' + error.message, { category: 'auth' });
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

// ==========================================
// OLVIDÉ MI CONTRASEÑA
// ==========================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Correo electrónico requerido.' });
    }

    const user = await Usuario.findOne({ email });
    if (!user) {
      logger.warn('Forgot-password: correo no encontrado - email=' + email, { category: 'auth' });
      return res.status(404).json({ success: false, message: 'No existe una cuenta con ese correo electrónico.' });
    }

    const payload = { id: user._id, email: user.email };
    const resetToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });

    logger.info('Token de recuperación generado - email=' + email + ' user=' + user.username, { category: 'auth' });
    res.json({ success: true, message: 'Token generado. Cópialo para restablecer tu contraseña.', resetToken });
  } catch (error) {
    logger.error('Error en forgot-password: ' + error.message, { category: 'auth' });
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

// ==========================================
// RESTABLECER CONTRASEÑA
// ==========================================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token y nueva contraseña son requeridos.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      logger.warn('Reset-password: token inválido o expirado', { category: 'auth' });
      return res.status(401).json({ success: false, message: 'Token inválido o expirado. Solicita uno nuevo.' });
    }

    const user = await Usuario.findById(decoded.id);
    if (!user) {
      logger.warn('Reset-password: usuario no encontrado - id=' + decoded.id, { category: 'auth' });
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    logger.info('Contraseña restablecida exitosamente - user=' + user.username, { category: 'auth' });
    res.json({ success: true, message: 'Contraseña actualizada exitosamente.' });
  } catch (error) {
    logger.error('Error en reset-password: ' + error.message, { category: 'auth' });
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

// ==========================================
// RUTAS OAUTH 2.0 (GOOGLE)
// ==========================================
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    const payload = { id: req.user._id, username: req.user.username };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    logger.info('Login OAuth Google exitoso - user=' + req.user.username, { category: 'auth' });
    res.redirect(`/?token=${token}&username=${encodeURIComponent(req.user.username)}`);
  }
);

module.exports = router;
