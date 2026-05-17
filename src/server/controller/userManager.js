/**
 * Gestor de Usuarios
 * Mantiene registro de usuarios logueados en tiempo real
 */
class UserManager {
  constructor() {
    this.connectedUsers = new Map(); // socketId -> { username, loginTime }
  }

  /**
   * Registra un usuario cuando se loguea
   * @param {string} socketId - ID único del socket
   * @param {string} username - Nombre del usuario
   */
  addUser(socketId, username, color) {
    this.connectedUsers.set(socketId, {
      username,
      color: color || '#5c6bc0',
      loginTime: new Date()
    });
  }

  /**
   * Elimina un usuario cuando se desconecta
   * @param {string} socketId - ID único del socket
   */
  removeUser(socketId) {
    this.connectedUsers.delete(socketId);
  }

  /**
   * Obtiene el número total de usuarios conectados
   * @returns {number} Total de usuarios logueados
   */
  getTotalUsers() {
    return this.connectedUsers.size;
  }

  /**
   * Obtiene lista de todos los usuarios conectados
   * @returns {array} Array de nombres de usuarios
   */
  getAllUsers() {
    return Array.from(this.connectedUsers.values()).map(u => u.username);
  }

  /**
   * Obtiene estadísticas de usuarios
   * @returns {object} Objeto con estadísticas
   */
  getStats() {
    return {
      totalConnectedUsers: this.connectedUsers.size,
      users: this.getAllUsers()
    };
  }
}

module.exports = new UserManager();

