/**
 * -------------------------------------------------------------
 * canvasHistory.js
 * -------------------------------------------------------------
 * Módulo compartido para gestionar el historial del canvas
 * Necesario para que los consumidores puedan guardar trazos en el historial
 */
const logger = require('./logs/logger');

const canvasHistory = new Map();
const canvasRedoHistory = new Map();
const MAX_HISTORY = 5000;

/**
 * Asegura que existan los historiales para una sala
 */
function ensureRoomHistory(roomId) {
  if (!canvasHistory.has(roomId)) {
    canvasHistory.set(roomId, []);
  }
  if (!canvasRedoHistory.has(roomId)) {
    canvasRedoHistory.set(roomId, []);
  }
}

/**
 * Obtiene el historial de una sala
 */
function getRoomHistory(roomId) {
  return canvasHistory.get(roomId) || [];
}

/**
 * Obtiene el historial de redo de una sala
 */
function getRoomRedoHistory(roomId) {
  return canvasRedoHistory.get(roomId) || [];
}

/**
 * Agrega una entrada al historial de una sala
 */
function pushToHistory(roomId, entry) {
  ensureRoomHistory(roomId);
  const history = canvasHistory.get(roomId);
  if (history.length < MAX_HISTORY) {
    history.push(entry);
    canvasRedoHistory.set(roomId, []);
  }
}

/**
 * Emite el estado del historial a una sala (necesita io)
 */
function emitRoomHistoryState(io, roomId) {
  io.to('room-' + roomId).emit('history-state-updated', {
    roomId,
    canUndo: getRoomHistory(roomId).length > 0,
    canRedo: getRoomRedoHistory(roomId).length > 0
  });
}

/**
 * Broadcast del historial completo a una sala
 */
function broadcastRoomHistory(io, roomId) {
  io.to('room-' + roomId).emit('canvas-history', getRoomHistory(roomId));
  emitRoomHistoryState(io, roomId);
}

/**
 * Envía el historial a un socket específico
 */
function sendCanvasHistory(socket, roomId) {
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
}

/**
 * Limpia el historial de una sala
 */
function clearRoomHistory(roomId) {
  canvasHistory.delete(roomId);
  canvasRedoHistory.delete(roomId);
}

module.exports = {
  ensureRoomHistory,
  getRoomHistory,
  getRoomRedoHistory,
  pushToHistory,
  emitRoomHistoryState,
  broadcastRoomHistory,
  sendCanvasHistory,
  clearRoomHistory,
  canvasHistory,
  canvasRedoHistory
};
