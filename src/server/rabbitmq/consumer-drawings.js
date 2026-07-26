require('dotenv').config();
const { connectRabbitMQ } = require('./connection');
const logger = require('../logs/logger');
const io = require('socket.io-client');

const PORT = process.env.PORT || 3000;
const HOST = process.env.WS_HOST || 'localhost';
const SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'drawnow_internal_service_dev';

const socket = io('http://' + HOST + ':' + PORT, {
  auth: { serviceToken: SERVICE_TOKEN },
  transports: ['websocket']
});

socket.on('connect', () => {
  logger.info('Consumer draw conectado a WebSocket interno', { category: 'rabbitmq' });
});

socket.on('connect_error', (err) => {
  logger.error('Consumer draw no pudo conectar a WebSocket interno: ' + err.message, { category: 'rabbitmq' });
});

function isValidDrawPayload(content) {
  if (!content || typeof content !== 'object') return false;
  const roomId = Number.parseInt(content.roomId, 10);
  if (!roomId || !Number.isFinite(roomId)) return false;
  if (!content.user || typeof content.user !== 'string') return false;
  if (!content.drawData || typeof content.drawData !== 'object') return false;
  const drawData = content.drawData;
  if (!Number.isFinite(drawData.x) || !Number.isFinite(drawData.y)) return false;
  if (!Number.isFinite(drawData.fromX) || !Number.isFinite(drawData.fromY)) return false;
  return true;
}

function emitProcessedDraw(content) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error('Socket interno no conectado'));
      return;
    }

    socket.emit('mq-draw-processed', content, (response) => {
      if (!response || !response.success) {
        reject(new Error((response && response.message) || 'Servidor rechazó trazo procesado'));
        return;
      }
      resolve();
    });
  });
}

const startConsumer = async () => {
  try {
    const channel = await connectRabbitMQ();
    const queue = 'drawing.events.q';

    await channel.checkQueue(queue);

    // Permite balanceo entre varios consumidores ejecutados en paralelo.
    channel.prefetch(5);

    logger.info(`[*] Esperando trazos en ${queue}. Para salir presiona CTRL+C`, { category: 'rabbitmq' });

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        let content = null;

        try {
          content = JSON.parse(msg.content.toString());
        } catch (error) {
          logger.error('[x] Trazo corrupto (JSON inválido), se envía a DLQ', { category: 'rabbitmq' });
          channel.nack(msg, false, false);
          return;
        }

        if (!isValidDrawPayload(content)) {
          logger.error('[x] Trazo inválido o incompleto, se envía a DLQ', { category: 'rabbitmq' });
          channel.nack(msg, false, false);
          return;
        }

        try {
          await emitProcessedDraw(content);
          logger.debug(`[v] Trazo procesado room=${content.roomId} user=${content.user}`, { category: 'rabbitmq' });
          channel.ack(msg);
        } catch (error) {
          logger.error('[x] Fallo retransmitiendo trazo procesado: ' + error.message, { category: 'rabbitmq' });
          channel.nack(msg, false, false);
        }
      }
    }, {
      noAck: false
    });

  } catch (error) {
    logger.error('Error iniciando consumidor de trazos: ' + error.message, { category: 'rabbitmq' });
    process.exit(1);
  }
};

startConsumer();
