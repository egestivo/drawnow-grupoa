/**
 * -------------------------------------------------------------
 * rabbitmq.js
 * -------------------------------------------------------------
 * Módulo de conexión compartida con RabbitMQ.
 * Proporciona un canal reutilizable para publicar mensajes.
 * Siguiendo el patrón del laboratorio ESPE (http-api.js).
 *
 * Uso:
 *   const channel = await getChannel();
 *   channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), options);
 */
require('dotenv').config();
const amqp = require('amqplib');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';
const DRAWING_EXCHANGE = 'drawnow.drawing';

let conn = null; // conexión compartida
let ch = null;   // canal compartido para reutilizar recursos

/**
 * Devuelve un canal válido (lo crea si no existe)
 * @returns {Promise<Channel>} Canal de RabbitMQ
 */
async function getChannel() {
  if (ch) {
    return ch;
  }

  try {
    conn = await amqp.connect(RABBIT_URL);
    ch = await conn.createChannel();
    await ch.assertExchange(DRAWING_EXCHANGE, 'topic', { durable: true });
    console.log('Canal RabbitMQ establecido:', DRAWING_EXCHANGE);
    return ch;
  } catch (error) {
    console.error('Error conectando a RabbitMQ:', error.message);
    throw error;
  }
}

/**
 * Publica un payload JSON en el exchange de dibujo
 * @param {string} routingKey - Routing key (ej: 'drawing.stroke')
 * @param {object} payload - Objeto a publicar
 * @param {object} options - Opciones adicionales de publicación
 */
async function publishDrawingEvent(routingKey, payload, options = {}) {
  try {
    const channel = await getChannel();
    channel.publish(DRAWING_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true, // modo persistente (delivery_mode 2)
      contentType: 'application/json',
      ...options
    });
  } catch (error) {
    console.error('Error publicando en RabbitMQ:', error.message);
    throw error;
  }
}

/**
 * Cierra la conexión y el canal de forma ordenada
 */
async function closeConnection() {
  try {
    if (ch) await ch.close();
    if (conn) await conn.close();
    ch = null;
    conn = null;
    console.log('Conexión RabbitMQ cerrada');
  } catch (error) {
    console.error('Error cerrando conexión RabbitMQ:', error.message);
  }
}

// Cierre ordenado cuando se mate el proceso (Ctrl+C)
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = {
  getChannel,
  publishDrawingEvent,
  closeConnection,
  RABBIT_URL,
  DRAWING_EXCHANGE
};
