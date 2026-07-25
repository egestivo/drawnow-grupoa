# Sistema de Colas de Trazos de Dibujo - RabbitMQ

## Descripción

Implementación del sistema de colas para manejar eventos de dibujo (`draw-data`) usando RabbitMQ, siguiendo el patrón del laboratorio ESPE. Este sistema permite:

- **Desacoplamiento**: Los trazos se publican en RabbitMQ en lugar de procesarse directamente
- **Escalabilidad**: Múltiples consumidores pueden procesar trazos en paralelo (Competing Consumers)
- **Tolerancia a fallos**: Trazos corruptos van a Dead-Letter Queue (DLQ)
- **TTL**: Mensajes no procesados después de 5 segundos expiran y van a DLQ (evita lag extremo)
- **Auditoría**: Trazos fallidos se registran en logs para análisis

## Arquitectura

### Componentes Creados

1. **setup-drawings.js**: Configura la topología de RabbitMQ
   - Exchange: `drawnow.drawing` (topic)
   - Cola principal: `drawing.events.q` (con TTL de 5s y DLQ)
   - DLX: `drawnow.dlx` (Dead-Letter Exchange)
   - DLQ: `drawing.dlq` (Dead-Letter Queue)

2. **rabbitmq.js**: Módulo de conexión compartida con RabbitMQ
   - Proporciona canal reutilizable para publicar mensajes
   - Maneja cierre ordenado de conexiones

3. **socketInstance.js**: Módulo compartido para instancia de Socket.io
   - Permite que los consumidores emitan mensajes a clientes

4. **canvasHistory.js**: Módulo compartido para historial del canvas
   - Centraliza la gestión del historial de trazos
   - Accesible desde socketManager y consumidores

5. **consumer-drawings.js**: Consumidor de trazos de dibujo
   - Procesa trazos con ACK manual
   - Valida datos antes de procesar
   - Rechaza trazos inválidos (NACK → DLQ)
   - Soporta múltiples instancias (Competing Consumers)

6. **consumer-dlq-drawings.js**: Consumidor de DLQ
   - Monitorea trazos fallidos
   - Registra en logs para auditoría
   - Analiza patrones de errores

## Instalación y Configuración

### 1. Instalar Dependencias

```bash
npm install
```

Esto instalará `amqplib` (agregado al package.json).

### 2. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

Configura la URL de RabbitMQ en `.env`:

```env
RABBIT_URL=amqp://guest:guest@localhost
```

Para RabbitMQ con Docker (recomendado):
```env
RABBIT_URL=amqp://guest:guest@localhost
```

Para RabbitMQ en servidor remoto:
```env
RABBIT_URL=amqp://usuario:password@host:puerto
```

### 3. Levantar RabbitMQ (Opcional - si no tienes uno)

Si no tienes RabbitMQ instalado, puedes usar Docker:

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3.13-management
```

UI de administración: http://localhost:15672 (guest/guest)

### 4. Configurar Topología de RabbitMQ

Ejecuta el script de setup (una sola vez):

```bash
npm run setup:drawings
```

Esto creará:
- Exchange `drawnow.drawing`
- Cola `drawing.events.q` con TTL de 5s y DLQ configurada
- DLX `drawnow.dlx`
- DLQ `drawing.dlq`

## Uso

### Iniciar el Servidor DrawNow

```bash
npm start
```

### Iniciar Consumidor de Trazos (Competing Consumer)

En una terminal:

```bash
npm run consume:drawings
```

Para balanceo de carga, puedes abrir múltiples terminales y ejecutar el mismo comando. RabbitMQ distribuirá los mensajes automáticamente (Round-robin).

### Iniciar Monitor de DLQ (Opcional)

En otra terminal:

```bash
npm run consume:dlq
```

Esto monitoreará los trazos fallidos y los registrará en logs para auditoría.

## Flujo Completo

```
Frontend (dibuja)
    ↓
WebSocket (draw-data)
    ↓
socketManager.js
    ↓
RabbitMQ (drawing.events.q) ← Publicación asíncrona
    ↓
Consumidor(s) consume:drawings ← Procesamiento con ACK manual
    ↓
canvasHistory + WebSocket broadcast
    ↓
[Si falla] → DLQ (drawing.dlq) → Log auditoría
```

## Validaciones Implementadas

El consumidor rechaza trazos (NACK → DLQ) cuando:

- `roomId` no está presente
- `user` no está presente
- `data` no está presente
- Coordenadas `x` o `y` son inválidas (undefined, NaN)
- `color` no es un string válido

## Características

### Competing Consumers

Puedes ejecutar múltiples instancias del consumidor para procesar trazos en paralelo:

```bash
# Terminal 1
npm run consume:drawings

# Terminal 2
npm run consume:drawings

# Terminal 3
npm run consume:drawings
```

RabbitMQ distribuirá los mensajes equitativamente entre todas las instancias.

### TTL (Time-To-Live)

Los mensajes en `drawing.events.q` expiran después de 5 segundos si no son procesados. Los mensajes expirados se envían automáticamente a la DLQ para evitar dibujos desfasados (lag extremo).

### ACK Manual

El consumidor solo hace ACK después de procesar exitosamente el trazo. Si hay error, hace NACK y el mensaje va a la DLQ.

### Auditoría

Los trazos fallidos en la DLQ se registran en el sistema de logging (Winston) con detalles del error para análisis posterior.

## Scripts Disponibles

```bash
npm run setup:drawings    # Configura topología RabbitMQ
npm run consume:drawings  # Inicia consumidor de trazos
npm run consume:dlq       # Inicia monitor de DLQ
npm start                 # Inicia servidor DrawNow
```

## Monitoreo

### UI de RabbitMQ

Accede a http://localhost:15672 (guest/guest) para ver:
- Exchanges creados
- Colas y sus mensajes
- DLQ y mensajes fallidos
- Bindings entre exchanges y colas

### Logs del Sistema

Los trazos fallidos se registran en:
- `logs/error.log` (errores generales)
- `logs/sistema.log` (logs del sistema)

## Troubleshooting

### Error: "Error conectando a RabbitMQ"

Verifica que:
- RabbitMQ esté corriendo (`docker ps` o `rabbitmqctl status`)
- La URL en `.env` sea correcta
- Las credenciales sean correctas

### Error: "Socket.io no disponible"

El consumidor necesita que el servidor DrawNow esté corriendo para emitir mensajes por WebSocket. Inicia el servidor con `npm start`.

### Trazos no se guardan en historial

Verifica que:
- El consumidor esté corriendo (`npm run consume:drawings`)
- No haya errores en la consola del consumidor
- La topología de RabbitMQ esté configurada (`npm run setup:drawings`)

### Muchos mensajes en DLQ

Revisa los logs para identificar patrones de errores:
- Coordenadas inválidas
- Datos corruptos
- Problemas de validación

Ajusta las validaciones en `consumer-drawings.js` según sea necesario.

## Patrones del Laboratorio ESPE Aplicados

✅ Topic Exchange para enrutamiento por patrón  
✅ Dead-Letter Exchange para mensajes fallidos  
✅ ACK manual para confirmación de procesamiento  
✅ NACK (reject) para mensajes inválidos  
✅ TTL para expiración de mensajes viejos  
✅ Competing Consumers para balanceo de carga  
✅ Persistencia de colas y mensajes  
✅ Auditoría de errores en DLQ  
