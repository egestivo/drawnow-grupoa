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
    io.emit('user-stats-updated', roomManager.getStats());
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
      userManager.addUser(socket.id, username);

      if (callback) callback({ success: true });
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

      emitGlobalUpdates();
      console.log('Sala ' + roomId + ' eliminada por: ' + socket.username);
    });

    /**
     * Evento: draw-data
     * Descripción: Transmite datos de dibujo a otros usuarios en la misma sala
     * Datos: { x, y, color }
     */
    socket.on('draw-data', (data) => {
      if (!socket.currentRoom || !socket.username) return;

      io.to('room-' + socket.currentRoom).emit('render-draw', {
        ...data,
        user: socket.username
      });
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

