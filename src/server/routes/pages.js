const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'drawnow_auth_secret_dev';

// Página de inicio principal
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/home.html'));
});

// Página de Login/Registro
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/login.html'));
});

// Página de autenticación de administrador
router.get('/auth/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/auth-admin.html'));
});

// Panel de administración (protegido)
router.get('/admin', (req, res) => {
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.username === 'admin') {
        return res.sendFile(path.join(__dirname, '../../public/pages/admin-panel.html'));
      }
    } catch (err) {
      // Token inválido, redirigir
    }
  }
  res.redirect('/auth/admin');
});

module.exports = router;
