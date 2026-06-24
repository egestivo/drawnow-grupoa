const logger = require('../logs/logger');

/**
 * GESTOR DE SALAS - RoomManager
 * Responsabilidades:
 *   - Crear nuevas salas
 *   - Gestionar participantes
 *   - Eliminar salas
 *   - Mantener estadísticas
 */
class RoomManager {
  constructor() {
    this.rooms = [];
    this.roomIdCounter = 0;
  }

  /**
   * Normaliza el nombre de una sala para comparaciones internas
   * @param {string} name - Nombre de sala a normalizar
   * @returns {string} Nombre normalizado
   */
  normalizeRoomName(name) {
    return typeof name === 'string' ? name.trim().toLowerCase() : '';
  }

  /**
   * Verifica si ya existe una sala con el mismo nombre
   * @param {string} name - Nombre de sala a comprobar
   * @returns {boolean} True si el nombre ya está ocupado
   */
  isRoomNameTaken(name) {
    const normalized = this.normalizeRoomName(name);
    if (!normalized) return false;

    return this.rooms.some(room => this.normalizeRoomName(room.name) === normalized);
  }

  /**
   * Crea una nueva sala de dibujo
   * @param {string} name - Nombre de la sala
   * @param {string} createdBy - Nombre del usuario que la crea
   * @returns {object} Objeto de sala creada
   */
  createRoom(name, createdBy) {
    this.roomIdCounter++;
    const room = {
      id: this.roomIdCounter,
      name: name || `Sala ${this.roomIdCounter}`,
      createdBy: createdBy || 'Usuario',
      participants: [],
      createdAt: new Date(),
      updated: new Date()
    };
    this.rooms.push(room);
    logger.debug('RoomManager: sala creada internamente - id=' + room.id + ' nombre="' + room.name + '" creador=' + createdBy, { category: 'sistema' });
    return room;
  }

  /**
   * Añade un usuario a una sala
   * @param {number} roomId - ID de la sala
   * @param {string} socketId - ID del socket del usuario
   * @param {string} username - Nombre del usuario
   * @returns {object|null} Sala actualizada o null si no existe
   */
  joinRoom(roomId, socketId, username) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) return null;

    if (!room.participants.find(p => p.socketId === socketId)) {
      room.participants.push({ socketId, username });
      room.updated = new Date();
    }
    return room;
  }

  /**
   * Retira un usuario de una sala
   * @param {number} roomId - ID de la sala
   * @param {string} socketId - ID del socket del usuario
   * @returns {object|null} Sala actualizada o null si no existe
   */
  leaveRoom(roomId, socketId) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) return null;

    room.participants = room.participants.filter(p => p.socketId !== socketId);
    room.updated = new Date();
    return room;
  }

  /**
   * Elimina una sala solo si no hay participantes activos excepto quien la solicita
   * @param {number} roomId - ID de la sala a eliminar
   * @param {string} requesterSocketId - ID del socket que solicita la eliminación
   * @returns {object} { success: boolean, message: string }
   */
  deleteRoom(roomId, requesterSocketId) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) {
      return { success: false, message: 'Sala no encontrada' };
    }

    // Contar participantes activos (excluyendo quien solicita la eliminación)
    const activeParticipants = room.participants.filter(p => p.socketId !== requesterSocketId);
    if (activeParticipants.length > 0) {
      return {
        success: false,
        message: 'No puedes eliminar una sala con participantes activos en este instante'
      };
    }

    this.rooms = this.rooms.filter(r => r.id !== roomId);
    logger.debug('RoomManager: sala eliminada - id=' + roomId, { category: 'sistema' });
    return { success: true, message: 'Sala eliminada' };
  }

  /**
   * Elimina una sala por decisión del administrador (solo si está vacía)
   * @param {number} roomId - ID de la sala a eliminar
   * @returns {object} { success: boolean, message: string }
   */
  deleteRoomByAdmin(roomId) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) {
      return { success: false, message: 'Sala no encontrada' };
    }

    if (room.participants.length > 0) {
      return {
        success: false,
        message: 'No puedes eliminar una sala con participantes activos en este instante'
      };
    }

    this.rooms = this.rooms.filter(r => r.id !== roomId);
    return { success: true, message: 'Sala eliminada por el administrador' };
  }

  /**
   * Obtiene lista de salas con información pública
   * @returns {array} Array de salas formateadas
   */
  getRooms() {
    return this.rooms.map(room => ({
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      participantCount: room.participants.length,
      participants: room.participants.map(p => p.username),
      createdAt: room.createdAt,
      updated: room.updated
    }));
  }

  /**
   * Obtiene lista de salas con información detallada para administración
   * @returns {array} Array de salas con participantes completos
   */
  getDetailedRooms() {
    return this.rooms.map(room => ({
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      participantCount: room.participants.length,
      participants: room.participants.map(p => ({
        socketId: p.socketId,
        username: p.username
      })),
      createdAt: room.createdAt,
      updated: room.updated
    }));
  }

  /**
   * Obtiene una sala detallada por ID para administración o depuración
   * @param {number} roomId - ID de la sala
   * @returns {object|null} Sala detallada o null si no existe
   */
  getDetailedRoomById(roomId) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) return null;

    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      participantCount: room.participants.length,
      participants: room.participants.map(p => ({
        socketId: p.socketId,
        username: p.username
      })),
      createdAt: room.createdAt,
      updated: room.updated
    };
  }

  /**
   * Obtiene estadísticas del sistema (solo de salas)
   * Nota: Para usuarios conectados, usar userManager
   * @returns {object} Estadísticas con totalRooms y rooms
   */
  getStats() {
    return {
      totalRooms: this.rooms.length,
      totalUsers: this.rooms.reduce((sum, r) => sum + r.participants.length, 0),
      rooms: this.getRooms()
    };
  }

  /**
   * Retira un usuario de todas las salas
   * Útil cuando el usuario se desconecta
   * @param {string} socketId - ID del socket a remover
   */
  removeUserFromAll(socketId) {
    this.rooms.forEach(room => {
      room.participants = room.participants.filter(p => p.socketId !== socketId);
      room.updated = new Date();
    });
  }
}

module.exports = new RoomManager();

