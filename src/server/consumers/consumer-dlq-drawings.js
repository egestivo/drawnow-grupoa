/**
 * -------------------------------------------------------------
 * consumer-dlq-drawings.js
 * -------------------------------------------------------------
 * Consumidor de Dead-Letter Queue para trazos fallidos.
 * Monitorea la cola drawing.dlq y registra los trazos rechazados
 * para auditoría y análisis de errores.
 *
 * Conceptos aplicados del laboratorio ESPE:
 * - Lectura de DLQ
 * - Logging de mensajes fallidos
 * - Auditoría de errores
 *
 * Uso:
 *   npm run consume:dlq
 */
require('dotenv').config();
const amqp = require('amqplib');
const logger = require('../logs/logger');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

// Lista de colas DLQ a monitorear
const DLQS = ['drawing.dlq'];

(async () => {
  console.log('Conectando a RabbitMQ para monitorear DLQ:', RABBIT_URL);

  const conn = await amqp.connect(RABBIT_URL);

  // Creamos un canal por DLQ para simplificar logs independientes
  for (const q of DLQS) {
    const ch = await conn.createChannel();
    await ch.assertQueue(q, { durable: true });
    console.log('Escuchando DLQ:', q);

    ch.consume(q, (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        console.log('Trazo fallido en DLQ (' + q + '):', content);

        // Registrar en logger para auditoría
        logger.error('Trazo corrupto rechazado en DLQ', {
          queue: q,
          roomId: content.roomId,
          user: content.user,
          kind: content.kind,
          timestamp: content.timestamp,
          error: 'Validación fallida en consumidor',
          data: content.data
        });

        // Aquí podrías:
        // - Guardar en una base de datos especial para auditoría
        // - Notificar a un sistema externo (email/Slack) si hay muchos errores
        // - Analizar patrones de errores para mejorar validaciones
        // - Re-publicar al exchange original tras aplicar backoff (con cuidado)

        ch.ack(msg); // Confirmamos lectura del mensaje fallido
      } catch (error) {
        console.error('Error procesando mensaje de DLQ:', error.message);
        ch.ack(msg); // Aún así hacemos ACK para no bloquear la DLQ
      }
    }, { noAck: false });
  }

  console.log('Monitor de DLQ listo - Registrando trazos fallidos para auditoría');

})().catch(err => {
  console.error('DLQ consumer error:', err);
  process.exit(1);
});
