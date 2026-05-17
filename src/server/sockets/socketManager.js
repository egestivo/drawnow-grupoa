const roomManager = require('../controller/roomController');
const userManager = require('../controller/userManager');

/**
 * Gestor de WebSockets
 * Maneja todas las conexiones en tiempo real de los clientes
 */
module.exports = (io) => {
  /**
   * Convierte un valor a número entero válido para roomId
   * @param {any} value - Valor a convertir
   * @returns {number|null} RoomId válido o null
   */
  const parseRoomId = (value) => {
    const roomId = Number.parseInt(value, 10);
    return Number.isNaN(roomId) ? null : roomId;
  };

  /**
   * Emite actualizaciones globales a todos los clientes
   * Incluye lista de salas y estadísticas de usuarios
   */
  const emitGlobalUpdates = () => {
    io.emit('rooms-list-updated', { rooms: roomManager.getRooms() });
    io.emit('user-stats-updated', {
      ...roomManager.getStats(),
      totalConnectedUsers: userManager.getTotalUsers()
    });
    io.emit('users-online-updated', userManager.getStats());
  };

  /**
   * Envía un error en formato estándar a través del callback
   * @param {function} callback - Callback del socket
   * @param {string} message - Mensaje de error
   */
  const sendError = (callback, message) => {
    if (callback) {
      callback({ success: false, message });
    }
  };

  const canvasHistory = new Map();
  const MAX_HISTORY = 5000;

  const pushToHistory = (roomId, entry) => {
    if (!canvasHistory.has(roomId)) {
      canvasHistory.set(roomId, []);
    }
  const history = canvasHistory.get(roomId);
    if (history.length < MAX_HISTORY) {
      history.push(entry);
    }
  };

  const sendCanvasHistory = (socket, roomId) => {
    const history = canvasHistory.get(roomId) || [];
    if (history.length > 0) {
      socket.emit('canvas-history', history);
    }
  };

  io.on('connection', (socket) => {
    console.log('Conexion: ' + socket.id);

    /**
     * Evento: login
     * Descripción: Se ejecuta cuando un usuario ingresa con su nombre
     * Datos: { username: string }
     */
    socket.on('login', (data, callback) => {
      const username = data && typeof data.username === 'string'
        ? data.username.trim()
        : '';

      if (!username) {
        sendError(callback, 'Nombre requerido');
        return;
      }

      socket.username = username;

      // Paleta de hermosos colores pasteles y vivos para identificar a cada usuario dibujando
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

    /**
     * Evento: list-rooms
     * Descripción: Solicita la lista actualizada de salas disponibles
     */
    socket.on('list-rooms', (data, callback) => {
      const rooms = roomManager.getRooms();
      if (callback) callback({ success: true, rooms });
      socket.emit('rooms-list-updated', { rooms });
    });

    /**
     * Evento: create-room
     * Descripción: Crea una nueva sala de dibujo
     * Datos: { roomName: string }
     */
    socket.on('create-room', (data, callback) => {
      if (!socket.username) {
        sendError(callback, 'Usuario no identificado');
        return;
      }

      const roomName = data && typeof data.roomName === 'string'
        ? data.roomName.trim()
        : '';
      const room = roomManager.createRoom(roomName, socket.username);

      if (callback) callback({ success: true, room });
      emitGlobalUpdates();
      console.log('Sala creada: ' + room.name + ' por: ' + socket.username);
    });

    /**
     * Evento: join-room
     * Descripción: Usuario ingresa a una sala existente
     * Datos: { roomId: number }
     */
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

      if (callback) callback({ success: true, room });

      io.to('room-' + roomId).emit('user-joined', {
        username: socket.username,
        participants: room.participants.map(p => p.username)
      });

      emitGlobalUpdates();
      console.log('Unio: ' + socket.username + ' a sala ' + roomId);
    });

    /**
     * Evento: leave-room
     * Descripción: Usuario sale de una sala
     * Datos: { roomId: number }
     */
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

    /**
     * Evento: delete-room
     * Descripción: Elimina una sala (solo si no hay participantes activos)
     * Datos: { roomId: number }
     */
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

      emitGlobalUpdates();
      console.log('Sala ' + roomId + ' eliminada por: ' + socket.username);
    });

    /**
     * Evento: delete-room-admin
     * Descripción: Permite al administrador eliminar una sala (solo si está vacía)
     * Datos: { roomId: number }
     */
    socket.on('delete-room-admin', (data, callback) => {
      const roomId = parseRoomId(data && data.roomId);
      if (!roomId) {
        sendError(callback, 'Sala no valida');
        return;
      }

      const result = roomManager.deleteRoomByAdmin(roomId);

      if (callback) callback(result);
      if (!result.success) return;

      io.to('room-' + roomId).emit('room-deleted', {
        message: result.message
      });

      emitGlobalUpdates();
      console.log('Sala ' + roomId + ' eliminada por Administrador');
    });

    /**
     * Evento: draw-data
     * Descripción: Transmite datos de dibujo a otros usuarios en la misma sala
     * Datos: { x, y, color }
     */
    socket.on('draw-data', (data) => {
      if (!socket.currentRoom || !socket.username) return;
      // Guardar en historial
      if (!canvasHistory.has(socket.currentRoom)) {
       canvasHistory.set(socket.currentRoom, []);
      }
      canvasHistory.get(socket.currentRoom).push({ ...data, user: socket.username });

      io.to('room-' + socket.currentRoom).emit('render-draw', {
        ...data,
        user: socket.username
      });
    });

    /**
     * Evento: clear-canvas
     * Descripción: Limpia el lienzo de todos los participantes en la sala
     */
    socket.on('clear-canvas', () => {
      if (!socket.currentRoom) return;
      canvasHistory.set(socket.currentRoom, []);
      io.to('room-' + socket.currentRoom).emit('canvas-cleared');
    });

    /**
     * Evento: flood-fill
     * Descripción: Transmite los datos de relleno con bote de pintura a la sala
     * Datos: { x, y, color }
     */
    socket.on('flood-fill', (data) => {
      if (!socket.currentRoom) return;
    // Guardar flood-fill en historial
    if (!canvasHistory.has(socket.currentRoom)) {
      canvasHistory.set(socket.currentRoom, []);
    }
    canvasHistory.get(socket.currentRoom).push({ __type: 'flood-fill', ...data });
      io.to('room-' + socket.currentRoom).emit('render-flood-fill', data);
    });

    /**
     * Evento: disconnect
     * Descripción: Se ejecuta cuando un usuario se desconecta
     * Limpia datos del usuario de todas las salas
     */
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

      emitGlobalUpdates();
    });
  });
};

