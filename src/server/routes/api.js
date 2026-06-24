const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const roomManager = require('../controller/roomController');
const userManager = require('../controller/userManager');
const Sala = require('../models/Sala');

const JWT_SECRET = process.env.JWT_SECRET || 'drawnow_auth_secret_dev';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token no proporcionado.' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
  }
}

// ==========================================
// POST /api/rooms — Crear sala (con JWT)
// ==========================================
router.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, message: 'El nombre de la sala es requerido.' });
    }
    const sala = new Sala({ nombre, idUsuario: req.user.id });
    await sala.save();
    res.status(201).json({ success: true, sala });
  } catch (error) {
    console.error('Error creando sala:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

// ==========================================
// DELETE /api/rooms/:id — Eliminar sala (solo el creador)
// ==========================================
router.delete('/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const sala = await Sala.findById(req.params.id);
    if (!sala) {
      return res.status(404).json({ success: false, message: 'Sala no encontrada.' });
    }
    if (sala.idUsuario !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No autorizado: no eres el creador de esta sala.' });
    }
    await Sala.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sala eliminada correctamente.' });
  } catch (error) {
    console.error('Error eliminando sala:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});

// ==========================================
// GET /api/stats
// ==========================================
router.get('/stats', (req, res) => {
  res.json({
    timestamp: new Date(),
    ...roomManager.getStats(),
    rooms: roomManager.getDetailedRooms(),
    totalConnectedUsers: userManager.getTotalUsers()
  });
});

// ==========================================
// GET /api/rooms
// ==========================================
router.get('/rooms', (req, res) => {
  res.json({
    timestamp: new Date(),
    rooms: roomManager.getRooms()
  });
});

// ==========================================
// GET /api/room/:id
// ==========================================
router.get('/room/:id', (req, res) => {
  const room = roomManager.rooms.find(r => r.id === parseInt(req.params.id));
  if (!room) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  res.json({
    timestamp: new Date(),
    room: {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      participants: room.participants.map(p => ({ username: p.username })),
      participantCount: room.participants.length,
      createdAt: room.createdAt
    }
  });
});

module.exports = router;
