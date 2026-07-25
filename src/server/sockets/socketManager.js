const roomManager = require('../controller/roomController');
const userManager = require('../controller/userManager');
const jwt = require('jsonwebtoken');
const Sala = require('../models/Sala');
const logger = require('../logs/logger');
const { publishDrawingEvent } = require('../rabbitmq');
const { setIo } = require('../socketInstance');
const { 
  pushToHistory, 
  emitRoomHistoryState, 
  broadcastRoomHistory, 
  sendCanvasHistory,
  ensureRoomHistory,
  getRoomHistory,
  getRoomRedoHistory
} = require('../canvasHistory');

module.exports = (io) => {
  // Guardar instancia de io para que los consumidores puedan emitir mensajes
  setIo(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('No autenticado'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'drawnow_auth_secret_dev');
      socket.jwtUser = decoded;
      next();
    } catch (err) {
      return next(new Error('Token inválido'));
    }
  });

  const parseRoomId = (value) => {
    const roomId = Number.parseInt(value, 10);
    return Number.isNaN(roomId) ? null : roomId;
  };

  const emitGlobalUpdates = () => {
    io.emit('rooms-list-updated', { rooms: roomManager.getRooms() });
    io.emit('user-stats-updated', {
      ...roomManager.getStats(),
      rooms: roomManager.getDetailedRooms(),
      totalConnectedUsers: userManager.getTotalUsers()
    });
    io.emit('users-online-updated', userManager.getStats());
  };

  const sendError = (callback, message) => {
    if (callback) {
      callback({ success: false, message });
    }
  };

  io.on('connection', (socket) => {
    const userLabel = socket.jwtUser ? socket.jwtUser.username : 'unknown';
    logger.debug('Socket conectado: ' + socket.id + ' user=' + userLabel, { category: 'sistema' });
    socket.kickedRooms = new Set();

    // Si es admin, unirlo a la sala 'admins' para logs en vivo
    if (socket.jwtUser && socket.jwtUser.username === 'admin') {
      socket.join('admins');
      logger.info('Admin conectado al panel de logs en vivo - user=' + userLabel, { category: 'sistema' });
    }

    const username = socket.jwtUser.username;
    const colors = [
      '#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb',
      '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784',
      '#aed581', '#ffb74d', '#ff8a65'
    ];
    const userColor = colors[Math.floor(Math.random() * colors.length)];
    socket.username = username;
    socket.color = userColor;
    userManager.addUser(socket.id, username, userColor);
    logger.info('Usuario autenticado conectado: ' + username, { category: 'sistema' });
    emitGlobalUpdates();

    socket.on('list-rooms', (data, callback) => {
      const rooms = roomManager.getRooms();
      if (callback) callback({ success: true, rooms });
      socket.emit('rooms-list-updated', { rooms });
    });

    socket.on('create-room', (data, callback) => {
      const roomName = data && typeof data.roomName === 'string'
        ? data.roomName.trim()
        : '';

      if (roomName && roomManager.isRoomNameTaken(roomName)) {
        sendError(callback, 'Ya existe una sala con ese nombre. Elige otro.');
        return;
      }

      const room = roomManager.createRoom(roomName, socket.username);
      Sala.create({ nombre: roomName || `Sala ${room.id}`, idUsuario: socket.jwtUser.id }).catch(err => {
        logger.error('Error guardando sala en MongoDB: ' + err.message, { category: 'sistema' });
      });
      if (callback) callback({ success: true, room });
      emitGlobalUpdates();
      logger.info('Sala creada: ' + room.name + ' por: ' + socket.username + ' id=' + room.id, { category: 'sistema' });
    });

    socket.on('join-room', (data, callback) => {
      const roomId = parseRoomId(data && data.roomId);
      if (!roomId) {
        sendError(callback, 'Sala no valida');
        return;
      }

      if (socket.kickedRooms && socket.kickedRooms.has(roomId)) {
        sendError(callback, 'Has sido expulsado de esta sala y no puedes volver a entrar en esta conexión');
        return;
      }

      if (socket.currentRoom && socket.currentRoom !== roomId) {
        const previousRoom = roomManager.leaveRoom(socket.currentRoom, socket.id);
        socket.leave('room-' + socket.currentRoom);

        if (previousRoom) {
          io.to('room-' + socket.currentRoom).emit('user-left', {
            username: socket.username,
            participants: previousRoom.participants.map(p => p.username)
          });
        }

        socket.currentRoom = null;
      }

      const room = roomManager.joinRoom(roomId, socket.id, socket.username);

      if (!room) {
        sendError(callback, 'Sala no encontrada');
        return;
      }

      socket.currentRoom = roomId;
      socket.join('room-' + roomId);
      ensureRoomHistory(roomId);

      if (callback) callback({ success: true, room });

      sendCanvasHistory(socket, roomId);

      io.to('room-' + roomId).emit('user-joined', {
        username: socket.username,
        participants: room.participants.map(p => p.username)
      });

      emitGlobalUpdates();
      logger.info('Usuario entró a sala: ' + socket.username + ' salaId=' + roomId + ' sala=' + room.name, { category: 'sistema' });
    });

    socket.on('leave-room', (data, callback) => {
      const roomId = parseRoomId(data && data.roomId);
      if (!roomId) {
        sendError(callback, 'Sala no valida');
        return;
      }

      const room = roomManager.leaveRoom(roomId, socket.id);
      if (!room) {
        sendError(callback, 'Sala no encontrada');
        return;
      }

      socket.leave('room-' + roomId);

      if (socket._currentStroke) socket._currentStroke = null;

      if (callback) callback({ success: true });

      io.to('room-' + roomId).emit('user-left', {
        username: socket.username,
        participants: room.participants.map(p => p.username)
      });

      emitGlobalUpdates();
      logger.info('Usuario salió de sala: ' + socket.username + ' salaId=' + roomId, { category: 'sistema' });

      if (socket.currentRoom === roomId) {
        socket.currentRoom = null;
      }
    });

    socket.on('delete-room', (data, callback) => {
      const roomId = parseRoomId(data && data.roomId);
      if (!roomId) {
        sendError(callback, 'Sala no valida');
        return;
      }

      const room = roomManager.rooms.find(r => r.id === roomId);
      if (!room) {
        sendError(callback, 'Sala no encontrada');
        return;
      }
      if (room.createdBy !== socket.username) {
        sendError(callback, 'No puedes eliminar esta sala porque no la creaste tú');
        return;
      }

      const result = roomManager.deleteRoom(roomId, socket.id);

      if (callback) callback(result);
      if (!result.success) return;

      io.to('room-' + roomId).emit('room-deleted', {
        message: result.message
      });

      socket.leave('room-' + roomId);
      if (socket.currentRoom === roomId) {
        socket.currentRoom = null;
      }

      canvasHistory.delete(roomId);
      canvasRedoHistory.delete(roomId);

      emitGlobalUpdates();
      logger.info('Sala eliminada por usuario: ' + roomId + ' por: ' + socket.username, { category: 'sistema' });
    });

    socket.on('delete-room-admin', (data, callback) => {
      const roomId = parseRoomId(data && data.roomId);
      if (!roomId) {
        sendError(callback, 'Sala no valida');
        return;
      }

      const result = roomManager.deleteRoomByAdmin(roomId);

      if (callback) callback(result);
      if (!result.success) return;

      canvasHistory.delete(roomId);
      canvasRedoHistory.delete(roomId);

      io.to('room-' + roomId).emit('room-deleted', {
        message: result.message
      });

      emitGlobalUpdates();
      logger.info('Sala eliminada por Administrador: ' + roomId, { category: 'sistema' });
    });

    socket.on('logout-user', () => {
      if (socket.currentRoom) {
        const roomId = socket.currentRoom;
        const room = roomManager.leaveRoom(roomId, socket.id);

        socket.leave('room-' + roomId);

        if (room) {
          io.to('room-' + roomId).emit('user-left', {
            username: socket.username,
            participants: room.participants.map(p => p.username)
          });
        }
      }

      socket.currentRoom = null;
      userManager.removeUser(socket.id);
      socket.username = null;
      socket.color = null;
      emitGlobalUpdates();
      logger.info('Usuario cerró sesión: ' + (socket.jwtUser ? socket.jwtUser.username : 'unknown'), { category: 'auth' });
    });

    socket.on('kick-user-admin', (data, callback) => {
      const roomId = parseRoomId(data && data.roomId);
      const targetSocketId = data && typeof data.socketId === 'string' ? data.socketId : '';

      if (!roomId) {
        sendError(callback, 'Sala no valida');
        return;
      }

      if (!targetSocketId) {
        sendError(callback, 'Usuario no valido');
        return;
      }

      const room = roomManager.leaveRoom(roomId, targetSocketId);
      if (!room) {
        sendError(callback, 'Sala no encontrada');
        return;
      }

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        if (!targetSocket.kickedRooms) {
          targetSocket.kickedRooms = new Set();
        }
        targetSocket.kickedRooms.add(roomId);
        targetSocket.leave('room-' + roomId);
        targetSocket.currentRoom = null;
        targetSocket.emit('kicked-from-room', {
          roomId,
          message: 'Has sido expulsado de la sala por un administrador'
        });
      }

      io.to('room-' + roomId).emit('user-left', {
        username: targetSocket && targetSocket.username ? targetSocket.username : 'Usuario',
        participants: room.participants.map(p => p.username)
      });

      if (callback) callback({ success: true, message: 'Usuario expulsado correctamente' });
      emitGlobalUpdates();
      logger.info('Admin expulsó usuario - salaId=' + roomId + ' targetSocket=' + targetSocketId, { category: 'sistema' });
    });

    socket.on('draw-start', (data) => {
      if (!socket.currentRoom || !socket.username) return;
      socket._currentStroke = {
        strokeId: data && data.strokeId ? data.strokeId : null,
        meta: data && data.meta ? data.meta : {},
        segments: []
      };
      if (data && data.point) {
        const p = data.point;
        socket._currentStroke.segments.push({
          fromX: p.x,
          fromY: p.y,
          x: p.x,
          y: p.y,
          color: socket._currentStroke.meta.color || socket.color,
          size: socket._currentStroke.meta.size,
          style: socket._currentStroke.meta.style,
          tool: socket._currentStroke.meta.tool
        });
      }
    });

    socket.on('draw-data', (data) => {
      if (!socket.currentRoom || !socket.username) return;

      // Emitir inmediatamente por WebSocket para respuesta rápida al usuario
      io.to('room-' + socket.currentRoom).emit('render-draw', {
        ...data,
        user: socket.username
      });

      // Manejar _currentStroke localmente (estado específico del socket)
      if (socket._currentStroke && (!data.strokeId || data.strokeId === socket._currentStroke.strokeId)) {
        socket._currentStroke.segments.push({ ...data });
      } else {
        // Publicar en RabbitMQ para guardado persistente en historial
        const payload = {
          roomId: socket.currentRoom,
          data: data,
          user: socket.username,
          kind: 'stroke',
          timestamp: new Date().toISOString()
        };

        publishDrawingEvent('drawing.stroke', payload)
          .catch(err => logger.error('Error publicando trazo en RabbitMQ: ' + err.message, { category: 'sistema' }));
      }
    });

    socket.on('draw-end', (data) => {
      if (!socket.currentRoom || !socket.username) return;
      if (!socket._currentStroke) return;

      const entry = {
        __type: 'stroke',
        stroke: {
          strokeId: socket._currentStroke.strokeId,
          meta: socket._currentStroke.meta,
          segments: socket._currentStroke.segments
        },
        user: socket.username,
        createdAt: new Date()
      };

      pushToHistory(socket.currentRoom, entry);
      socket._currentStroke = null;
      broadcastRoomHistory(io, socket.currentRoom);
    });

    socket.on('clear-canvas', () => {
      if (!socket.currentRoom) return;
      pushToHistory(socket.currentRoom, {
        __type: 'clear-canvas',
        user: socket.username,
        createdAt: new Date()
      });
      io.to('room-' + socket.currentRoom).emit('canvas-cleared');
      broadcastRoomHistory(io, socket.currentRoom);
    });

    socket.on('undo-drawing', (callback) => {
      if (!socket.currentRoom) {
        sendError(callback, 'No estás en ninguna sala');
        return;
      }

      const roomId = socket.currentRoom;
      ensureRoomHistory(roomId);
      const history = getRoomHistory(roomId);
      if (!history.length) {
        sendError(callback, 'No hay acciones para deshacer');
        return;
      }

      const removed = history.pop();
      getRoomRedoHistory(roomId).push(removed);

      if (callback) callback({ success: true });
      broadcastRoomHistory(io, roomId);
    });

    socket.on('redo-drawing', (callback) => {
      if (!socket.currentRoom) {
        sendError(callback, 'No estás en ninguna sala');
        return;
      }

      const roomId = socket.currentRoom;
      ensureRoomHistory(roomId);
      const redoHistory = getRoomRedoHistory(roomId);
      if (!redoHistory.length) {
        sendError(callback, 'No hay acciones para rehacer');
        return;
      }

      const restored = redoHistory.pop();
      getRoomHistory(roomId).push(restored);

      if (callback) callback({ success: true });
      broadcastRoomHistory(io, roomId);
    });

    socket.on('flood-fill', (data) => {
      if (!socket.currentRoom) return;
      pushToHistory(socket.currentRoom, { __type: 'flood-fill', ...data });
      io.to('room-' + socket.currentRoom).emit('render-flood-fill', data);
      emitRoomHistoryState(io, socket.currentRoom);
    });

    socket.on('disconnect', () => {
      logger.info('Socket desconectado: ' + (socket.username || socket.id), { category: 'sistema' });

      if (socket.currentRoom) {
        const room = roomManager.leaveRoom(socket.currentRoom, socket.id);
        if (room) {
          io.to('room-' + socket.currentRoom).emit('user-left', {
            username: socket.username,
            participants: room.participants.map(p => p.username)
          });
        }
      }

      roomManager.removeUserFromAll(socket.id);
      userManager.removeUser(socket.id);

      if (socket.kickedRooms) socket.kickedRooms.clear();
      if (socket._currentStroke) socket._currentStroke = null;

      emitGlobalUpdates();
    });
  });
};
