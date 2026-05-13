const express = require('express');
const router = express.Router();
const roomManager = require('../controller/roomController');

/**
 * API: GET /api/stats
 * Descripción: Obtiene estadísticas en tiempo real del sistema
 * Retorna: {totalRooms, totalUsers, connectedUsers, rooms[]}
 */
router.get('/stats', (req, res) => {
  res.json({
    timestamp: new Date(),
    ...roomManager.getStats()
  });
});

/**
 * API: GET /api/rooms
 * Descripción: Lista todas las salas disponibles
 * Retorna: array de salas con información detallada
 */
router.get('/rooms', (req, res) => {
  res.json({
    timestamp: new Date(),
    rooms: roomManager.getRooms()
  });
});

/**
 * API: GET /api/room/:id
 * Descripción: Obtiene detalles de una sala específica
 * Parámetros: id (número)
 * Retorna: objeto de sala o error 404
 */
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

