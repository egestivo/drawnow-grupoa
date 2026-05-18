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
 * INICIAR SERVIDORES
 */
const PORT = process.env.PORT || 3000;
const TCP_PORT = process.env.TCP_PORT || 4000;
const isRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL);
const enableTcpServer = typeof process.env.ENABLE_TCP_SERVER === 'string'
  ? process.env.ENABLE_TCP_SERVER === 'true'
  : !isRender;

let tcpServer = null;

/**
 * SERVIDOR TCP (para dibujadores IoT)
 * En Render se desactiva por defecto para no bloquear el despliegue web.
 */
if (enableTcpServer) {
  const createTcpServer = require('./tcp/tcpserver');
  tcpServer = createTcpServer(io);
}

server.listen(PORT, () => {
  console.log('');
  console.log('===== DrawNow Server =====');
  console.log('Web: http://localhost:' + PORT);
  console.log('Admin: http://localhost:' + PORT + '/auth/admin');
  console.log('API: http://localhost:' + PORT + '/api/stats');
  console.log('===========================');
  console.log('');
});

if (tcpServer) {
  tcpServer.listen(TCP_PORT, () => {
    console.log('TCP Server listening on port ' + TCP_PORT);
  });
} else {
  console.log('TCP Server desactivado para este entorno');
}

module.exports = { app, io };

