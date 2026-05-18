/**
 * Gestor de Usuarios
 * Mantiene registro de usuarios logueados en tiempo real
 */
class UserManager {
  constructor() {
    this.connectedUsers = new Map(); // socketId -> { username, loginTime }
  }

  /**
   * Normaliza un nombre para comparaciones internas
   * @param {string} username - Nombre a normalizar
   * @returns {string} Nombre normalizado
   */
  normalizeUsername(username) {
    return typeof username === 'string' ? username.trim().toLowerCase() : '';
  }

  /**
   * Registra un usuario cuando se loguea
   * @param {string} socketId - ID único del socket
   * @param {string} username - Nombre del usuario
   */
  addUser(socketId, username, color) {
    this.connectedUsers.set(socketId, {
      username,
      normalizedUsername: this.normalizeUsername(username),
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
   * Verifica si un nombre ya está en uso por otra conexión activa
   * @param {string} username - Nombre a comprobar
   * @param {string} [excludeSocketId] - Socket a ignorar en la comparación
   * @returns {boolean} True si ya existe otro usuario con ese nombre
   */
  isUsernameTaken(username, excludeSocketId = null) {
    const normalized = this.normalizeUsername(username);
    if (!normalized) return false;

    for (const [socketId, user] of this.connectedUsers.entries()) {
      if (excludeSocketId && socketId === excludeSocketId) continue;
      if (user.normalizedUsername === normalized) return true;
    }

    return false;
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
   * Obtiene el usuario completo a partir del nombre
   * @param {string} username - Nombre a buscar
   * @returns {object|null} Usuario encontrado o null
   */
  getUserByUsername(username) {
    const normalized = this.normalizeUsername(username);
    if (!normalized) return null;

    for (const user of this.connectedUsers.values()) {
      if (user.normalizedUsername === normalized) {
        return user;
      }
    }

    return null;
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

