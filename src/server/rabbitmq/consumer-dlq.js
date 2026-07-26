require('dotenv').config();
const { connectRabbitMQ } = require('./connection');
const logger = require('../logs/logger');

const startDLQConsumer = async () => {
  try {
    const channel = await connectRabbitMQ();
    const queue = 'drawing.dlq';

    logger.info(`[🛡️] Auditoría DLQ escuchando en ${queue}. Para salir presiona CTRL+C`, { category: 'rabbitmq' });

    channel.consume(queue, (msg) => {
      if (msg !== null) {
        const content = msg.content.toString();
        
        // Extraer el motivo por el cual el mensaje murió (TTL o NACK)
        const deathHeader = msg.properties.headers['x-death'];
        const reason = deathHeader ? deathHeader[0].reason : 'Rechazado manualmente / Formato inválido';
            
        logger.error(`[DLQ] ❌ Mensaje descartado capturado. Motivo: ${reason}`, { category: 'rabbitmq' });
        logger.error(`[DLQ] Contenido: ${content}`, { category: 'rabbitmq' });
        
        // Hacemos ACK para sacarlo de la DLQ ya que fue registrado en los logs
        channel.ack(msg);
      }
    }, { noAck: false });

  } catch (error) {
    logger.error('Error iniciando consumidor DLQ: ' + error.message, { category: 'rabbitmq' });
    process.exit(1);
  }
};

startDLQConsumer();