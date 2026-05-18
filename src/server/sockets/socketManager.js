const roomManager = require('../controller/roomController');
const userManager = require('../controller/userManager');


module.exports = (io) => {

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

  const canvasHistory = new Map();
  const canvasRedoHistory = new Map();
  const MAX_HISTORY = 5000;

  const ensureRoomHistory = (roomId) => {
    if (!canvasHistory.has(roomId)) {
      canvasHistory.set(roomId, []);
    }
    if (!canvasRedoHistory.has(roomId)) {
      canvasRedoHistory.set(roomId, []);
    }
  };

  const getRoomHistory = (roomId) => canvasHistory.get(roomId) || [];
  const getRoomRedoHistory = (roomId) => canvasRedoHistory.get(roomId) || [];

  const emitRoomHistoryState = (roomId) => {
    io.to('room-' + roomId).emit('history-state-updated', {
      roomId,
      canUndo: getRoomHistory(roomId).length > 0,
      canRedo: getRoomRedoHistory(roomId).length > 0
    });
  };

  const broadcastRoomHistory = (roomId) => {
    io.to('room-' + roomId).emit('canvas-history', getRoomHistory(roomId));
    emitRoomHistoryState(roomId);
  };

  const pushToHistory = (roomId, entry) => {
    ensureRoomHistory(roomId);
    const history = canvasHistory.get(roomId);
    if (history.length < MAX_HISTORY) {
      history.push(entry);
      canvasRedoHistory.set(roomId, []);
    }
  };

  const sendCanvasHistory = (socket, roomId) => {
    ensureRoomHistory(roomId);
    const history = getRoomHistory(roomId);
    if (history.length > 0) {
      socket.emit('canvas-history', history);
    }
    socket.emit('history-state-updated', {
      roomId,
      canUndo: history.length > 0,
      canRedo: getRoomRedoHistory(roomId).length > 0
    });
  };

  io.on('connection', (socket) => {
    console.log('Conexion: ' + socket.id);
    socket.kickedRooms = new Set();

    socket.on('login', (data, callback) => {
      const username = data && typeof data.username === 'string'
        ? data.username.trim()
        : '';

      if (!username) {
        sendError(callback, 'Nombre requerido');
        return;
      }

      if (userManager.isUsernameTaken(username, socket.id)) {
        sendError(callback, 'Ese nombre ya está en uso. Elige otro.');
        return;
      }

      socket.username = username;

      const colors = [
        '#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb',
        '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784',
        '#aed581', '#ffb74d', '#ff8a65'
      ];
      const userColor = colors[Math.floor(Math.random() * colors.length)];
      socket.color = userColor;

      userManager.addUser(socket.id, username, userColor);

      if (callback) callback({ success: true, color: userColor });
      console.log('Login: ' + username);

      emitGlobalUpdates();
    });


    socket.on('list-rooms', (data, callback) => {
      const rooms = roomManager.getRooms();
      if (callback) callback({ success: true, rooms });
      socket.emit('rooms-list-updated', { rooms });
    });


    socket.on('create-room', (data, callback) => {
      if (!socket.username) {
        sendError(callback, 'Usuario no identificado');
        return;
      }

      const roomName = data && typeof data.roomName === 'string'
        ? data.roomName.trim()
        : '';

      if (roomName && roomManager.isRoomNameTaken(roomName)) {
        sendError(callback, 'Ya existe una sala con ese nombre. Elige otro.');
        return;
      }

      const room = roomManager.createRoom(roomName, socket.username);

      if (callback) callback({ success: true, room });
      emitGlobalUpdates();
      console.log('Sala creada: ' + room.name + ' por: ' + socket.username);
    });


    socket.on('join-room', (data, callback) => {
      if (!socket.username) {
        sendError(callback, 'Usuario no identificado');
        return;
      }

      const roomId = parseRoomId(data && data.roomId);
      if (!roomId) {
        sendError(callback, 'Sala no valida');
        return;
      }

      if (socket.kickedRooms && socket.kickedRooms.has(roomId)) {
        sendError(callback, 'Has sido expulsado de esta sala y no puedes volver a entrar en esta conexión');
        return;
      }

      // Si el usuario estaba en otra sala, se retira primero
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
      console.log('Unio: ' + socket.username + ' a sala ' + roomId);
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

      // Limpiar cualquier trazo en curso del socket
      if (socket._currentStroke) socket._currentStroke = null;

      if (callback) callback({ success: true });

      io.to('room-' + roomId).emit('user-left', {
        username: socket.username,
        participants: room.participants.map(p => p.username)
      });

      emitGlobalUpdates();
      console.log('Salio: ' + socket.username + ' de sala ' + roomId);

      if (socket.currentRoom === roomId) {
        socket.currentRoom = null;
      }
    });


    socket.on('delete-room', (data, callback) => {
      if (!socket.username) {
        sendError(callback, 'Usuario no identificado');
        return;
      }

      const roomId = parseRoomId(data && data.roomId);
      if (!roomId) {
        sendError(callback, 'Sala no valida');
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
      console.log('Sala ' + roomId + ' eliminada por: ' + socket.username);
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
      console.log('Sala ' + roomId + ' eliminada por Administrador');
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
    });


    socket.on('draw-start', (data) => {
      if (!socket.currentRoom || !socket.username) return;
      // data: { strokeId, meta, point }
      socket._currentStroke = {
        strokeId: data && data.strokeId ? data.strokeId : null,
        meta: data && data.meta ? data.meta : {},
        segments: []
      };
      // Opcional: añadir primer punto si viene en data.point
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

    // Datos de trazo (segmentos) enviados mientras el usuario arrastra
    socket.on('draw-data', (data) => {
      if (!socket.currentRoom || !socket.username) return;

      // Transmitir inmediatamente el segmento a los demás para dibujo en vivo
      io.to('room-' + socket.currentRoom).emit('render-draw', {
        ...data,
        user: socket.username
      });

      // Si existe un trazo en curso en este socket, agrupar el segmento
      if (socket._currentStroke && (!data.strokeId || data.strokeId === socket._currentStroke.strokeId)) {
        socket._currentStroke.segments.push({ ...data });
      } else {
        // Si no hay trazo en curso, como fallback, tratar el segmento como acción individual
        pushToHistory(socket.currentRoom, {
          ...data,
          user: socket.username,
          kind: 'stroke'
        });
        emitRoomHistoryState(socket.currentRoom);
      }
    });

    socket.on('draw-end', (data) => {
      if (!socket.currentRoom || !socket.username) return;
      if (!socket._currentStroke) {
        if (typeof data === 'function') return; // evitar confusión con callback
        return;
      }

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
      // Limpiar buffer del socket
      socket._currentStroke = null;

      broadcastRoomHistory(socket.currentRoom);
    });


    socket.on('clear-canvas', () => {
      if (!socket.currentRoom) return;
      pushToHistory(socket.currentRoom, {
        __type: 'clear-canvas',
        user: socket.username,
        createdAt: new Date()
      });
      io.to('room-' + socket.currentRoom).emit('canvas-cleared');
      broadcastRoomHistory(socket.currentRoom);
    });


    socket.on('undo-drawing', (callback) => {
      if (!socket.currentRoom) {
        sendError(callback, 'No estás en ninguna sala');
        return;
      }

      const roomId = socket.currentRoom;
      ensureRoomHistory(roomId);
      const history = canvasHistory.get(roomId);
      if (!history.length) {
        sendError(callback, 'No hay acciones para deshacer');
        return;
      }

      const removed = history.pop();
      canvasRedoHistory.get(roomId).push(removed);

      if (callback) callback({ success: true });
      broadcastRoomHistory(roomId);
    });


    socket.on('redo-drawing', (callback) => {
      if (!socket.currentRoom) {
        sendError(callback, 'No estás en ninguna sala');
        return;
      }

      const roomId = socket.currentRoom;
      ensureRoomHistory(roomId);
      const redoHistory = canvasRedoHistory.get(roomId);
      if (!redoHistory.length) {
        sendError(callback, 'No hay acciones para rehacer');
        return;
      }

      const restored = redoHistory.pop();
      canvasHistory.get(roomId).push(restored);

      if (callback) callback({ success: true });
      broadcastRoomHistory(roomId);
    });


    socket.on('flood-fill', (data) => {
      if (!socket.currentRoom) return;

      pushToHistory(socket.currentRoom, { __type: 'flood-fill', ...data });

      io.to('room-' + socket.currentRoom).emit('render-flood-fill', data);

      emitRoomHistoryState(socket.currentRoom);
    });


    socket.on('disconnect', () => {
      console.log('Desconexion: ' + (socket.username || socket.id));

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

      if (socket.kickedRooms) {
        socket.kickedRooms.clear();
      }

      // Limpiar trazo en curso si existe
      if (socket._currentStroke) socket._currentStroke = null;

      emitGlobalUpdates();
    });
  });
};

