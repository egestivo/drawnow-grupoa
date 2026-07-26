require('dotenv').config();
const mongoose = require('mongoose');
const { connectRabbitMQ } = require('./connection');
const Sala = require('../models/Sala');
const logger = require('../logs/logger');
const io = require('socket.io-client');

// Conectar a la base de datos
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drawnow';
const PORT = process.env.PORT || 3000;
const HOST = process.env.WS_HOST || 'localhost';
const SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'drawnow_internal_service_dev';

const socket = io('http://' + HOST + ':' + PORT, {
  auth: { serviceToken: SERVICE_TOKEN },
  transports: ['websocket']
});

socket.on('connect', () => {
  logger.info('Consumidor de salas conectado a WebSocket interno', { category: 'rabbitmq' });
});

socket.on('connect_error', (err) => {
  logger.error('Consumidor de salas no pudo conectar a WebSocket interno: ' + err.message, { category: 'rabbitmq' });
});

function notifyRoomPersisted(payload) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error('Socket interno no conectado'));
      return;
    }

    socket.emit('mq-room-persisted', payload, (response) => {
      if (!response || !response.success) {
        reject(new Error((response && response.message) || 'Servidor rechazó notificación de persistencia'));
        return;
      }
      resolve();
    });
  });
}

const startConsumer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Consumidor de Salas conectado a MongoDB', { category: 'rabbitmq' });

    const channel = await connectRabbitMQ();
    const queue = 'rooms.q';

    // Asegurar que la cola existe
    await channel.assertQueue(queue, { durable: true });
    
    // Procesar 1 mensaje a la vez (Fair dispatch)
    channel.prefetch(1);

    logger.info(`[*] Esperando mensajes en ${queue}. Para salir presiona CTRL+C`, { category: 'rabbitmq' });

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const routingKey = msg.fields.routingKey;
        let content = null;

        try {
          content = JSON.parse(msg.content.toString());
        } catch (error) {
          logger.error('[x] Mensaje de sala con JSON inválido', { category: 'rabbitmq' });
          channel.nack(msg, false, false);
          return;
        }
        
        logger.info(`[x] Recibido ${routingKey}: Procesando...`, { category: 'rabbitmq' });
        
        // Simular retraso de procesamiento para notar el mensaje "Unacked" en RabbitMQ UI
        setTimeout(async () => {
          try {
            if (routingKey === 'room.create') {
              await Sala.updateOne(
                { roomId: Number(content.roomId) },
                {
                  $set: {
                    roomId: Number(content.roomId),
                    nombre: content.nombre || `Sala ${content.roomId}`,
                    idUsuario: content.idUsuario
                  }
                },
                { upsert: true }
              );

              await notifyRoomPersisted({
                action: 'create',
                roomId: content.roomId,
                nombre: content.nombre || `Sala ${content.roomId}`
              });

              logger.info(`[v] Sala '${content.nombre}' guardada en DB exitosamente.`, { category: 'rabbitmq' });
            } else if (routingKey === 'room.delete') {
              await Sala.deleteOne({ roomId: Number(content.roomId) });

              await notifyRoomPersisted({
                action: 'delete',
                roomId: content.roomId,
                nombre: content.nombre || `Sala ${content.roomId}`
              });

              logger.info(`[v] Evento de eliminación de sala '${content.roomId}' procesado.`, { category: 'rabbitmq' });
            }

            channel.ack(msg);
          } catch (error) {
            logger.error(`[x] Error procesando mensaje ${routingKey}: ` + error.message, { category: 'rabbitmq' });
            channel.nack(msg, false, false);
          }
        }, 5000);
      }
    }, {
      noAck: false // IMPORTANTE: ack manual habilitado
    });

  } catch (error) {
    logger.error('Error iniciando consumidor de salas: ' + error.message, { category: 'rabbitmq' });
    process.exit(1);
  }
};

startConsumer();
