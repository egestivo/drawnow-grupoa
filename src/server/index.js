const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});


app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());


const pageRoutes = require('./routes/pages');
app.use(pageRoutes);


const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);


const socketManager = require('./sockets/socketManager');
socketManager(io);


const createTcpServer = require('./tcp/tcpServer');
const tcpServer = createTcpServer(io);


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

