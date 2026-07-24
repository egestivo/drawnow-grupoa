const amqp = require('amqplib');
const logger = require('../logs/logger');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  if (channel) return channel;

  const uri = process.env.RABBITMQ_URI || 'amqp://localhost';
  try {
    connection = await amqp.connect(uri);
    channel = await connection.createChannel();
    logger.info('Conectado a RabbitMQ en ' + uri, { category: 'rabbitmq' });
    
    // Manejo de cierres y errores
    connection.on('error', (err) => {
      logger.error('Error en conexión RabbitMQ: ' + err.message, { category: 'rabbitmq' });
    });
    connection.on('close', () => {
      logger.error('Conexión RabbitMQ cerrada', { category: 'rabbitmq' });
      channel = null;
      connection = null;
    });

    return channel;
  } catch (error) {
    logger.error('Fallo al conectar a RabbitMQ: ' + error.message, { category: 'rabbitmq' });
    throw error;
  }
};

const getChannel = () => channel;

module.exports = {
  connectRabbitMQ,
  getChannel
};
