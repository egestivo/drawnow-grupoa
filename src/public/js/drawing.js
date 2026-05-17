/**
 * MÓDULO: Drawing
 * Descripción: Gestiona la funcionalidad de dibujo colaborativo en el canvas
 * Responsabilidades:
 *   - Capturar movimientos del mouse
 *   - Renderizar puntos en el canvas
 *   - Transmitir datos de dibujo vía WebSocket
 *   - Manejar redimensionamiento del canvas
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let currentUserColor = '#5c6bc0'; // Color único de pincel del usuario, asignado por el servidor

/**
 * Dimensiona el canvas al tamaño del contenedor
 * Se ejecuta cuando cambia el tamaño de la ventana
 */
function resizeCanvas() {
  if (!canvas.parentElement) return;
  canvas.width = canvas.parentElement.offsetWidth;
  canvas.height = window.innerHeight - 70;
}

/**
 * Dibuja un punto en el canvas local
 * @param {object} data - Datos del punto { x, y, color }
 * @param {string} label - Nombre del usuario que dibuja
 */
const cursorsLayer = document.getElementById('cursors-layer');
const activeCursors = {}; // username -> { element, timeout }

/**
 * Dibuja y actualiza un cursor flotante temporal sobre la pizarra colaborativa
 */
function updateFloatingCursor(user, x, y, color) {
  if (!cursorsLayer) return;

  let cursor = activeCursors[user];
  if (!cursor) {
    const el = document.createElement('div');
    el.className = 'floating-cursor';
    el.style.position = 'absolute';
    el.style.background = color;
    el.style.color = '#fff';
    el.style.padding = '2px 8px';
    el.style.borderRadius = '12px';
    el.style.fontSize = '10px';
    el.style.fontWeight = 'bold';
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'nowrap';
    el.style.transition = 'transform 0.08s ease-out, opacity 0.2s';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    el.style.zIndex = '1000';
    el.textContent = user;
    cursorsLayer.appendChild(el);

    cursor = { el, timeout: null };
    activeCursors[user] = cursor;
  }

  cursor.el.style.opacity = '1';
  cursor.el.style.transform = `translate(${x}px, ${y}px)`;

  if (cursor.timeout) {
    clearTimeout(cursor.timeout);
  }

  cursor.timeout = setTimeout(() => {
    cursor.el.style.opacity = '0';
    setTimeout(() => {
      if (cursor.el.parentNode) {
        cursor.el.parentNode.removeChild(cursor.el);
      }
      delete activeCursors[user];
    }, 200);
  }, 1500);
}

/**
 * Dibuja un punto en el canvas local
 * @param {object} data - Datos del punto { x, y, color }
 * @param {string} label - Nombre del usuario que dibuja
 */
function renderPoint(data, label) {
  if (!ctx) return;

  ctx.fillStyle = data.color;
  ctx.beginPath();
  ctx.arc(data.x, data.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Actualizar el cursor dinámico flotante si el trazo es de otro usuario
  if (label && label !== 'Yo') {
    updateFloatingCursor(label, data.x, data.y, data.color);
  }
}

/**
 * Limpia todo el contenido del canvas
 */
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Configura el evento de dibujo al mover el mouse
 * Emite datos solo si hay una sala activa y hay presión del botón
 */
function setupDrawing() {
  canvas.addEventListener('mousemove', (e) => {
    if (e.buttons !== 1) return;
    if (typeof currentRoomId === 'undefined' || !currentRoomId) return;

    const rect = canvas.getBoundingClientRect();
    const drawData = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      color: currentUserColor
    };

    renderPoint(drawData, 'Yo');
    socket.emit('draw-data', drawData);
  });
}

/**
 * Event listener: Redimensionar ventana
 * Ajusta el tamaño del canvas dinámicamente
 */
window.addEventListener('resize', resizeCanvas);

/**
 * Inicialización del módulo
 */
resizeCanvas();
setupDrawing();

