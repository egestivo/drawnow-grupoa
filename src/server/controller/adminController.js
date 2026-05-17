const express = require('express');
const router = express.Router();
const roomManager = require('./roomController');
const userManager = require('./userManager');

router.get('/stats', (req, res) => {
  res.json({
    timestamp: new Date(),
    ...roomManager.getStats(),
    totalConnectedUsers: userManager.getTotalUsers()
  });
});

router.get('/rooms', (req, res) => {
  res.json({
    timestamp: new Date(),
    rooms: roomManager.getRooms()
  });
});

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

