const express = require('express');
const path = require('path');

const router = express.Router();

/**
 * Ruta: GET /
 * Descripción: Página de inicio principal
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/home.html'));
});

/**
 * Ruta: GET /auth/admin
 * Descripción: Página de login para administrador
 */
router.get('/auth/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/auth-admin.html'));
});

/**
 * Ruta: GET /admin
 * Descripción: Panel de administrador con estadísticas en tiempo real
 * Nota: Protegida con verificación de sesión en el cliente
 */
router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/admin-panel.html'));
});

/**
 * Ruta: GET /draw
 * Descripción: Página de dibujo colaborativo
 */
router.get('/draw', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/home.html'));
});

module.exports = router;

