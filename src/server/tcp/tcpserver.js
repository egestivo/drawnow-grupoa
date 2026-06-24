const net = require('net');
const roomManager = require('../controller/roomController');
const logger = require('../logs/logger');

module.exports = (io) => {
  const tcpServer = net.createServer((tcpSocket) => {
    const remoteAddr = tcpSocket.remoteAddress || 'desconocido';
    logger.info('TCP conectado: ' + remoteAddr, { category: 'sistema' });

    tcpSocket.on('data', (buffer) => {
      try {
        const rawData = buffer.toString().trim();
        const [x, y, color, roomId = 1] = rawData.split(',');

        if (x === undefined || y === undefined) return;

        io.to('room-' + roomId).emit('render-draw', {
          x: parseInt(x),
          y: parseInt(y),
          color: color || '#000',
          user: 'TCP_Bot'
        });

        logger.debug('Dibujo TCP en sala ' + roomId + ' desde ' + remoteAddr, { category: 'sistema' });
      } catch (err) {
        logger.error('Error procesando datos TCP: ' + err.message, { category: 'sistema' });
      }
    });

    tcpSocket.on('end', () => {
      logger.info('TCP desconectado: ' + remoteAddr, { category: 'sistema' });
    });

    tcpSocket.on('error', (err) => {
      logger.error('Error en socket TCP (' + remoteAddr + '): ' + err.message, { category: 'sistema' });
    });
  });

  return tcpServer;
};
