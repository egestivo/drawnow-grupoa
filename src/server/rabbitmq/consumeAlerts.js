// En consumeAlerts.js
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
  logger.info('Consumer alerts conectado a WebSocket interno', { category: 'rabbitmq' });
});

socket.on('connect_error', (err) => {
  logger.error('Consumer alerts no pudo conectar a WebSocket interno: ' + err.message, { category: 'rabbitmq' });
});

function emitGlobalAlertToServer(content) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error('Socket interno no conectado'));
      return;
    }

    socket.emit('mq-global-alert', content, (response) => {
      if (!response || !response.success) {
        reject(new Error((response && response.message) || 'Servidor rechazó alerta global'));
        return;
      }
      resolve();
    });
  });
}

const startConsumer = async () => {
  try {
    const channel = await connectRabbitMQ();
    const exchange = 'drawnow.topic';
    const queue = 'alerts.node.' + (process.env.NODE_ID || process.pid);

    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, {
      durable: false,
      autoDelete: true
    });
    await channel.bindQueue(queue, exchange, 'system.alert.broadcast');

    channel.prefetch(1);

    logger.info(`[*] Esperando alertas globales en ${queue}. Para salir presiona CTRL+C`, { category: 'rabbitmq' });

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        let content = null;
        try {
          content = JSON.parse(msg.content.toString());
        } catch (error) {
          logger.error('[x] Alerta global con JSON inválido, descartada', { category: 'rabbitmq' });
          channel.nack(msg, false, false);
          return;
        }

        if (!content || typeof content.message !== 'string' || !content.message.trim()) {
          logger.error('[x] Alerta global inválida, descartada', { category: 'rabbitmq' });
          channel.nack(msg, false, false);
          return;
        }

        try {
          await emitGlobalAlertToServer(content);
          logger.info(`[v] Alerta global entregada: ${content.message}`, { category: 'rabbitmq' });
          channel.ack(msg);
        } catch (error) {
          logger.error('[x] Error notificando alerta global al servidor: ' + error.message, { category: 'rabbitmq' });
          channel.nack(msg, false, false);
        }
      }
    }, { noAck: false });

  } catch (error) {
    logger.error('Error iniciando consumidor de alertas: ' + error.message, { category: 'rabbitmq' });
    process.exit(1);
  }
};

startConsumer();