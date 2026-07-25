/**
 * -------------------------------------------------------------
 * socketInstance.js
 * -------------------------------------------------------------
 * Módulo compartido para acceder a la instancia de Socket.io
 * Necesario para que los consumidores puedan emitir mensajes a los clientes
 */
let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

module.exports = {
  setIo,
  getIo
};
