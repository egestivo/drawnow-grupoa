# DrawNow - Pruebas Locales (RabbitMQ + MongoDB)

Esta guía replica el estilo de laboratorio que usaron: infraestructura local con Docker, setup de topología, consumidores en terminales separadas y validación de DLQ/broadcast.

## 1) Requisitos

- Node.js 18+
- Docker Desktop
- npm

## 2) Configurar entorno

1. Copia `.env.example` a `.env`.
2. Ajusta valores si lo necesitas (secretos, puertos, etc).

Variables clave:

- `RABBIT_URL` (formato laboratorio): `amqp://drawnow:drawnow123@localhost:5672/%2f`
- `MONGODB_URI`: `mongodb://localhost:27017/drawnow`
- `INTERNAL_SERVICE_TOKEN`: debe ser igual para web y consumidores

## 3) Levantar infraestructura local

```bash
npm run infra:up
```

Servicios levantados:

- RabbitMQ AMQP: `localhost:5672`
- RabbitMQ UI: `http://localhost:15672`
- MongoDB: `localhost:27017`

Credenciales RabbitMQ:

- user: `drawnow`
- pass: `drawnow123`

## 4) Instalar dependencias

```bash
npm install
```

## 5) Crear topología de colas/exchanges

```bash
npm run setup:mq
```

Esto crea:

- Exchange `drawnow.topic`
- Cola `rooms.q` (room.*)
- Cola `drawing.events.q` con TTL y DLQ
- Exchange DLX `drawnow.dlx`
- Cola `drawing.dlq`

Nota: las colas de alertas de broadcast se crean en `consume:alerts` como colas por nodo para que cada nodo web reciba la alerta.

## 6) Ejecutar procesos (cada uno en su terminal)

1. Servidor web:

```bash
npm start
```

2. Consumidor de salas:

```bash
npm run consume:rooms
```

3. Consumidor de alertas:

```bash
npm run consume:alerts
```

4. Consumidor de trazos (puedes abrir varias terminales para competing consumers):

```bash
npm run consume:drawings
```

5. Consumidor DLQ:

```bash
npm run consume:dlq
```

## 7) Pruebas funcionales

### 7.1 Login y salas

1. Abre `http://localhost:3000/login`
2. Registra un usuario y entra.
3. Crea una sala.
4. Verifica en la terminal de `consume:rooms` que llega `room.create`.

### 7.2 Dibujo por cola

1. Abre dos navegadores en la misma sala.
2. Dibuja desde uno.
3. Verifica que el otro renderiza.
4. Revisa logs de `consume:drawings` (si levantaste dos, verás reparto round-robin).

### 7.3 Broadcast de alerta global

1. Entra como admin al panel `/admin`.
2. Envía alerta global desde el bloque "Alerta Global".
3. Verifica que los usuarios reciben el evento y que `consume:alerts` registra el mensaje.

### 7.4 DLQ por rechazo/TTL

1. Detén temporalmente `consume:drawings`.
2. Dibuja varios trazos.
3. Espera a que pase TTL (5s).
4. Verifica en `consume:dlq` los mensajes expirados/rechazados.

## 8) Verificación en RabbitMQ UI

Abre `http://localhost:15672` y revisa:

- Exchanges: `drawnow.topic`, `drawnow.dlx`
- Queues: `rooms.q`, `drawing.events.q`, `drawing.dlq` y colas de alertas por nodo
- Mensajes encolados, rates, unacked

## 9) Apagar infraestructura

```bash
npm run infra:down
```

Si quieres borrar volúmenes (reinicio limpio):

```bash
docker compose -f docker-compose.local.yml down -v
```
