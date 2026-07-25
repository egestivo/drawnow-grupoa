/**
 * -------------------------------------------------------------
 * setup-drawings.js
 * -------------------------------------------------------------
 * Crea la topología de RabbitMQ para el sistema de trazos de dibujo:
 * - Exchange "drawnow.drawing" (tipo topic) para eventos de dibujo
 * - Dead-Letter Exchange "drawnow.dlx" para mensajes fallidos
 * - Cola "drawing.events.q" con TTL de 5 segundos y DLQ asociada
 * - Cola DLQ "drawing.dlq" para trazos rechazados o expirados
 *
 * Conceptos aplicados del laboratorio ESPE:
 * - durable: true -> la definición sobrevive reinicios
 * - x-message-ttl: 5000ms -> expira mensajes no procesados (evita lag)
 * - x-dead-letter-exchange: hacia dónde van mensajes rechazados
 * - Manual ACK en consumidores (configurado en consumer)
 */
require('dotenv').config();
const amqp = require('amqplib');

// URL de conexión AMQP (configurable vía variable de entorno)
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

// Exchange principal para eventos de dibujo (topic = enruta por patrón)
const DRAWING_EXCHANGE = 'drawnow.drawing';

// Exchange para Dead Letters (mensajes rechazados/expirados)
const DLX_EXCHANGE = 'drawnow.dlx';

// Cola principal de eventos de dibujo con TTL y DLQ configurada
const drawingQueue = {
  name: 'drawing.events.q',
  binding: 'drawing.stroke',
  dlq: 'drawing.dlq',
  ttl: 5000 // 5 segundos - si no se procesa, va a DLQ para evitar lag extremo
};

// Cola DLQ para trazos fallidos
const dlqQueue = {
  name: 'drawing.dlq',
  binding: 'drawing.dlq'
};

(async () => {
  console.log('Conectando a RabbitMQ:', RABBIT_URL);
  
  // 1) Conexión y canal
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  // 2) Declaración de exchanges (durables -> sobreviven reinicios)
  await ch.assertExchange(DRAWING_EXCHANGE, 'topic', { durable: true });
  console.log('Exchange creado:', DRAWING_EXCHANGE);

  await ch.assertExchange(DLX_EXCHANGE, 'topic', { durable: true });
  console.log('DLX creado:', DLX_EXCHANGE);

  // 3) Cola principal de dibujo con DLX y TTL configurados
  await ch.assertQueue(drawingQueue.name, {
    durable: true, // la cola es persistente
    arguments: {
      // Configuramos la DLX: hacia dónde irán los mensajes rechazados
      'x-dead-letter-exchange': DLX_EXCHANGE,
      // routing key que usaremos cuando el mensaje vaya a DLX
      'x-dead-letter-routing-key': drawingQueue.dlq,
      // TTL: si el mensaje no se consume en 5 segundos, expira y va a DLQ
      'x-message-ttl': drawingQueue.ttl
    }
  });
  console.log('Cola creada:', drawingQueue.name, '(TTL:', drawingQueue.ttl + 'ms)');

  // Binding de la cola con el exchange por routing key
  await ch.bindQueue(drawingQueue.name, DRAWING_EXCHANGE, drawingQueue.binding);
  console.log('Binding creado:', drawingQueue.name, '<-', drawingQueue.binding);

  // 4) Cola DLQ enlazada al DLX
  await ch.assertQueue(dlqQueue.name, { durable: true });
  console.log('DLQ creada:', dlqQueue.name);

  await ch.bindQueue(dlqQueue.name, DLX_EXCHANGE, dlqQueue.binding);
  console.log('Binding DLQ creado:', dlqQueue.name, '<-', dlqQueue.binding);

  console.log('\nSetup completo: exchanges, colas, bindings, DLQ y TTL configurados.');
  console.log('   - Exchange:', DRAWING_EXCHANGE);
  console.log('   - Cola trazos:', drawingQueue.name, '(TTL: 5s)');
  console.log('   - DLQ:', dlqQueue.name);
  console.log('   - DLX:', DLX_EXCHANGE);
  
  await ch.close();
  await conn.close();
})().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});
