const express = require('express');
const router = express.Router();
const roomManager = require('../controller/roomController');
const userManager = require('../controller/userManager');
const { publishMessage } = require('../rabbitmq/producer');
const jwt = require('jsonwebtoken');
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
    
    const roomId = Date.now();
    const published = publishMessage('room.create', {
      roomId,
      nombre,
      idUsuario: req.user.id
    });

    if (published) {
      res.status(202).json({ success: true, message: 'Creación de sala encolada en RabbitMQ.' });
    } else {
      res.status(500).json({ success: false, message: 'Error al encolar la sala.' });
    }
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
    const roomId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(roomId)) {
      return res.status(400).json({ success: false, message: 'ID de sala inválido.' });
    }

    const sala = await Sala.findOne({ roomId });
    if (!sala) {
      return res.status(404).json({ success: false, message: 'Sala no encontrada.' });
    }
    if (sala.idUsuario !== req.user.id && req.user.username !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado: no eres el creador de esta sala.' });
    }

    const published = publishMessage('room.delete', {
      roomId,
      nombre: sala.nombre,
      idUsuario: req.user.id
    });

    if (published) {
      return res.status(202).json({ success: true, message: 'Eliminación de sala encolada en RabbitMQ.' });
    }

    res.status(500).json({ success: false, message: 'Error al encolar eliminación de sala.' });
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

// Endpoint para emitir alertas globales (solo admin)
router.post('/broadcast-alert', authMiddleware, (req, res) => {
  if (!req.user || req.user.username !== 'admin') {
    return res.status(403).json({ success: false, message: 'No autorizado. Solo admin puede emitir alertas globales.' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  // Publicar la alerta en RabbitMQ
  const published = publishMessage('system.alert.broadcast', {
    type: 'alert',
    message: message,
    timestamp: new Date()
  });

  if (published) {
    res.json({ success: true, message: 'Alerta enviada al sistema de colas' });
  } else {
    res.status(500).json({ success: false, message: 'Error enviando alerta' });
  }
});

module.exports = router;
