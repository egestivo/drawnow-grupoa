require('dotenv').config();
const { connectRabbitMQ } = require('./connection');
const logger = require('../logs/logger');

const startConsumer = async () => {
  try {
    const channel = await connectRabbitMQ();
    const queue = 'alerts.q';

    // Asegurar que la cola existe
    await channel.assertQueue(queue, { durable: true });
    
    // Procesar 1 mensaje a la vez
    channel.prefetch(1);

    logger.info(`[*] Esperando alertas globales en ${queue}. Para salir presiona CTRL+C`, { category: 'rabbitmq' });

    channel.consume(queue, (msg) => {
      if (msg !== null) {
        const routingKey = msg.fields.routingKey;
        const content = JSON.parse(msg.content.toString());
        
        logger.info(`[x] ALERTA RECIBIDA (${routingKey}): ${content.message}`, { category: 'rabbitmq' });
        
        // Simular retraso de procesamiento para la guía
        setTimeout(() => {
          logger.info(`[v] Alerta procesada y notificada.`, { category: 'rabbitmq' });
          
          // Confirmar procesamiento exitoso (ACK)
          channel.ack(msg);
        }, 3000); // 3000ms delay
      }
    }, {
      noAck: false // ACK manual
    });

  } catch (error) {
    logger.error('Error iniciando consumidor de alertas: ' + error.message, { category: 'rabbitmq' });
    process.exit(1);
  }
};

startConsumer();
