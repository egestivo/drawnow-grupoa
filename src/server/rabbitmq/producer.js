const { getChannel } = require('./connection');
const logger = require('../logs/logger');

const publishMessage = (routingKey, message) => {
  const channel = getChannel();
  if (!channel) {
    logger.error('No se puede publicar el mensaje, el canal de RabbitMQ no está listo', { category: 'rabbitmq' });
    return false;
  }

  const exchange = 'drawnow.topic';
  try {
    const buffer = Buffer.from(JSON.stringify(message));
    // Publicar con persistent: true para que los mensajes sobrevivan reinicios
    channel.publish(exchange, routingKey, buffer, { persistent: true });
    logger.debug(`Mensaje publicado en '${exchange}' con routing key '${routingKey}'`, { category: 'rabbitmq' });
    return true;
  } catch (error) {
    logger.error(`Error publicando mensaje a '${routingKey}': ${error.message}`, { category: 'rabbitmq' });
    return false;
  }
};

module.exports = {
  publishMessage
};
