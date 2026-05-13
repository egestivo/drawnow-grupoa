const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

/**
 * MIDDLEWARE
 */
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

/**
 * RUTAS - Páginas
 */
const pageRoutes = require('./routes/pages');
app.use(pageRoutes);

/**
 * RUTAS - API
 */
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

/**
 * WEBSOCKETS
 */
const socketManager = require('./sockets/socketManager');
socketManager(io);

/**
 * SERVIDOR TCP (para dibujadores IoT)
 */
const createTcpServer = require('./tcp/tcpServer');
const tcpServer = createTcpServer(io);

/**
 * INICIAR SERVIDORES
 */
const PORT = process.env.PORT || 3000;
const TCP_PORT = process.env.TCP_PORT || 4000;

server.listen(PORT, () => {
  console.log('');
  console.log('===== DrawNow Server =====');
  console.log('Web: http://localhost:' + PORT);
  console.log('Admin: http://localhost:' + PORT + '/auth/admin');
  console.log('API: http://localhost:' + PORT + '/api/stats');
  console.log('===========================');
  console.log('');
});

tcpServer.listen(TCP_PORT, () => {
  console.log('TCP Server listening on port ' + TCP_PORT);
});

module.exports = { app, io };

