require('dotenv').config();
const mongoose = require('mongoose');
const { connectRabbitMQ } = require('./connection');
const Sala = require('../models/Sala');
const logger = require('../logs/logger');

// Conectar a la base de datos
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drawnow';

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

    channel.consume(queue, (msg) => {
      if (msg !== null) {
        const routingKey = msg.fields.routingKey;
        const content = JSON.parse(msg.content.toString());
        
        logger.info(`[x] Recibido ${routingKey}: Procesando...`, { category: 'rabbitmq' });
        
        // Simular retraso de procesamiento para notar el mensaje "Unacked" en RabbitMQ UI
        setTimeout(async () => {
          try {
            if (routingKey === 'room.create') {
              // Guardar la sala en la base de datos
              await Sala.create({ 
                nombre: content.nombre || `Sala ${content.roomId}`, 
                idUsuario: content.idUsuario 
              });
              logger.info(`[v] Sala '${content.nombre}' guardada en DB exitosamente.`, { category: 'rabbitmq' });
            } else if (routingKey === 'room.delete') {
              // Aquí podríamos eliminar la sala de la base de datos si fuera necesario
              // await Sala.deleteOne({ nombre: content.nombre });
              logger.info(`[v] Evento de eliminación de sala '${content.roomId}' procesado.`, { category: 'rabbitmq' });
            }
            
            // Confirmar procesamiento exitoso (ACK)
            channel.ack(msg);
          } catch (error) {
            logger.error(`[x] Error procesando mensaje ${routingKey}: ` + error.message, { category: 'rabbitmq' });
            // Rechazar mensaje en caso de error (puede ser reenviado o enviado a DLQ si estuviera configurada)
            channel.nack(msg, false, false);
          }
        }, 5000); // 5000ms delay como requiere la guía del laboratorio
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
