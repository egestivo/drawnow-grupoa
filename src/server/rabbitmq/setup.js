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

    // Crear la cola para alertas globales (broadcast)
    const alertsQueue = 'alerts.q';
    await channel.assertQueue(alertsQueue, { durable: true });
    await channel.bindQueue(alertsQueue, exchange, 'system.alert.*');
    logger.info(`Cola '${alertsQueue}' enlazada con patrón 'system.alert.*'`, { category: 'rabbitmq' });

    logger.info('Topología de RabbitMQ creada exitosamente', { category: 'rabbitmq' });
    process.exit(0);
  } catch (error) {
    logger.error('Error configurando la topología de RabbitMQ: ' + error.message, { category: 'rabbitmq' });
    process.exit(1);
  }
};

setup();
