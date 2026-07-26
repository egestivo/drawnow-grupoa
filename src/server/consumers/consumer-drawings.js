/**
 * -------------------------------------------------------------
 * consumer-drawings.js
 * -------------------------------------------------------------
 * Consumidor de eventos de dibujo (Competing Consumers).
 * Lee mensajes de la cola drawing.events.q, valida los trazos,
 * los guarda en el historial y emite por WebSockets.
 *
 * Conceptos aplicados del laboratorio ESPE:
 * - ACK manual (noAck: false)
 * - Validación de datos
 * - NACK (reject) para trazos inválidos → van a DLQ
 * - Puede ejecutarse múltiples instancias para balanceo de carga
 *
 * Uso:
 *   npm run consume:drawings
 *   (Puedes abrir múltiples terminales y ejecutar el mismo comando)
 */
require('dotenv').config();
const amqp = require('amqplib');
const { getIo } = require('../socketInstance');
const { pushToHistory, emitRoomHistoryState } = require('../canvasHistory');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';
const QUEUE = 'drawing.events.q';

(async () => {
  console.log('🎨 Conectando a RabbitMQ:', RABBIT_URL);
  
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  // Aseguramos que la cola exista y sea durable (debería existir por setup-drawings.js)
  await ch.checkQueue(QUEUE);
  console.log('✅ Escuchando trazos en:', QUEUE);

  // Consumimos con ACK manual (noAck: false)
  // prefetch: 1 para distribuir mensajes equitativamente entre consumidores
  await ch.prefetch(1);
  
  await ch.consume(QUEUE, async (msg) => {
    if (!msg) return;

    try {
      // Parse del JSON que envía el socketManager
      const content = JSON.parse(msg.content.toString());
      console.log('📥 Trazo recibido:', { roomId: content.roomId, user: content.user, kind: content.kind });

      // Validación de trazo (reglas de negocio)
      if (!content.roomId || !content.user || !content.data) {
        console.log('❌ Trazo inválido - rechazando a DLQ:', content);
        ch.reject(msg, false); // false → NO requeue → pasa al DLX/DLQ
        return;
      }

      // Validación adicional: coordenadas deben ser números válidos
      if (content.data.x === undefined || content.data.y === undefined || 
          isNaN(content.data.x) || isNaN(content.data.y)) {
        console.log('❌ Coordenadas inválidas - rechazando a DLQ:', content);
        ch.reject(msg, false);
        return;
      }

      // Validación: color debe ser string válido
      if (!content.data.color || typeof content.data.color !== 'string') {
        console.log('❌ Color inválido - rechazando a DLQ:', content);
        ch.reject(msg, false);
        return;
      }

      // Obtener instancia de Socket.io para emitir a la sala
      const io = getIo();
      if (!io) {
        console.log('⚠️  Socket.io no disponible - requeue');
        ch.nack(msg, true); // requeue para intentar más tarde
        return;
      }

      // Procesar trazo: guardar en historial
      pushToHistory(content.roomId, {
        ...content.data,
        user: content.user,
        kind: content.kind || 'stroke'
      });

      // Emitir estado actualizado del historial a la sala
      emitRoomHistoryState(io, content.roomId);

      // Simulamos trabajo asíncrono (opcional, para procesamiento pesado)
      // await new Promise(r => setTimeout(r, 10));

      // ACK manual: confirmamos procesamiento exitoso
      ch.ack(msg);
      console.log('✅ Trazo procesado y ACK:', { roomId: content.roomId, user: content.user });

    } catch (error) {
      console.error('❌ Error procesando trazo:', error.message);
      // Si hay error de parseo o procesamiento, rechazamos sin requeue
      ch.reject(msg, false);
    }
  }, { noAck: false });

  console.log('🔄 Consumidor de trazos listo (Competing Consumer mode)');
  console.log('💡 Tip: Ejecuta múltiples instancias para balanceo de carga');

})().catch(err => {
  console.error('❌ Consumer error:', err);
  process.exit(1);
});
