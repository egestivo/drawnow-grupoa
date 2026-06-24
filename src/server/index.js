require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const passport = require('passport');
const bcrypt = require('bcryptjs');

const logger = require('./logs/logger');
const morganMiddleware = require('./logs/morganMiddleware');
const Usuario = require('./models/Usuario');

const app = express();

// Morgan middleware para log de peticiones HTTP
app.use(morganMiddleware);

// Conexión a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drawnow';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    logger.info('Conectado a MongoDB', { category: 'sistema' });
    await seedAdminUser();
  })
  .catch(err => logger.error('Error conectando a MongoDB: ' + err.message, { category: 'sistema' }));

async function seedAdminUser() {
  try {
    const admin = await Usuario.findOne({ username: 'admin' });
    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(process.env.ADMIN_SECRET || 'admin123', salt);
      await new Usuario({ username: 'admin', password: hashed }).save();
      logger.info('Usuario admin creado por defecto', { category: 'auth' });
    }
  } catch (err) {
    logger.error('Error creando usuario admin: ' + err.message, { category: 'auth' });
  }
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Pasar io al logger para emitir logs en tiempo real a los admins
logger.setIo(io);

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

app.use(passport.initialize());
require('../config/passport');

const pageRoutes = require('./routes/pages');
app.use(pageRoutes);

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

const socketManager = require('./sockets/socketManager');
socketManager(io);

const createTcpServer = require('./tcp/tcpserver');
const tcpServer = createTcpServer(io);

const PORT = process.env.PORT || 3000;
const TCP_PORT = process.env.TCP_PORT || 4000;

server.listen(PORT, () => {
  logger.info('Servidor web iniciado en puerto ' + PORT, { category: 'sistema' });
  logger.info('Dashboard admin: http://localhost:' + PORT + '/auth/admin', { category: 'sistema' });
  logger.info('API stats: http://localhost:' + PORT + '/api/stats', { category: 'sistema' });
});
tcpServer.listen(TCP_PORT, () => {
  logger.info('Servidor TCP iniciado en puerto ' + TCP_PORT, { category: 'sistema' });
});

module.exports = { app, io };
