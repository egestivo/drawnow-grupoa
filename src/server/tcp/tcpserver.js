const net = require('net');
const roomManager = require('../controller/roomController');

module.exports = (io) => {
  const tcpServer = net.createServer((tcpSocket) => {
    console.log('TCP conectado: ' + tcpSocket.remoteAddress);

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

        console.log('Dibujo TCP en sala ' + roomId);
      } catch (err) {
        console.error('Error TCP: ' + err.message);
      }
    });

    tcpSocket.on('end', () => {
      console.log('TCP desconectado');
    });

    tcpSocket.on('error', (err) => {
      console.error('Error TCP: ' + err.message);
    });
  });

  return tcpServer;
};
