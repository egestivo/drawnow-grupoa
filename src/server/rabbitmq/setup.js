require('dotenv').config();
const { connectRabbitMQ } = require('./connection');
const logger = require('../logs/logger');

const setup = async () => {
  try {
    const channel = await connectRabbitMQ();
    const exchange = 'drawnow.topic';
    
    // Crear el Exchange tipo topic
    await channel.assertExchange(exchange, 'topic', { durable: true });
    logger.info(`Exchange '${exchange}' creado o verificado`, { category: 'rabbitmq' });

    // Crear la cola para la persistencia de salas
    const roomsQueue = 'rooms.q';
    await channel.assertQueue(roomsQueue, { durable: true });
    await channel.bindQueue(roomsQueue, exchange, 'room.*');
    logger.info(`Cola '${roomsQueue}' enlazada con patrón 'room.*'`, { category: 'rabbitmq' });

    // Las colas de alertas se crean por nodo en consumeAlerts.js para broadcast real.

    const dlx = 'drawnow.dlx';
    await channel.assertExchange(dlx, 'direct', { durable: true });
    
    const dlqQueue = 'drawing.dlq';
    await channel.assertQueue(dlqQueue, { durable: true });
    await channel.bindQueue(dlqQueue, dlx, 'draw.failed');
    logger.info(`DLQ '${dlqQueue}' creada y enlazada`, { category: 'rabbitmq' });

    const drawQueueArgs = {
      durable: true,
      deadLetterExchange: dlx,
      deadLetterRoutingKey: 'draw.failed',
      messageTtl: 5000 // Expira en 5 segundos si el consumidor muere
    };
    
    const drawQueue = 'drawing.events.q';
    await channel.assertQueue(drawQueue, drawQueueArgs);
    await channel.bindQueue(drawQueue, exchange, 'draw.event');
    logger.info(`Cola '${drawQueue}' enlazada con patrón 'draw.event'`, { category: 'rabbitmq' });

    logger.info('Topología de RabbitMQ creada exitosamente', { category: 'rabbitmq' });
    process.exit(0);
  } catch (error) {
    logger.error('Error configurando la topología de RabbitMQ: ' + error.message, { category: 'rabbitmq' });
    process.exit(1);
  }
};

setup();
