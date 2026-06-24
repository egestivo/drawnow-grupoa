const express = require('express');
const path = require('path');
const router = express.Router();

// Página de inicio principal (Contiene Home, Salas y Canvas)
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/home.html'));
});

// NUEVA RUTA: Servir la página de Login/Registro separada
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/login.html'));
});

router.get('/auth/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/auth-admin.html'));
});

router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/admin-panel.html'));
});

// NUEVA RUTA: Página de recuperación/restablecimiento de contraseña
router.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/reset-password.html'));
});

module.exports = router;