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
function renderPoint(data, label) {
  if (!ctx) return;

  ctx.fillStyle = data.color;
  ctx.beginPath();
  ctx.arc(data.x, data.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "11px sans-serif";
  ctx.fillStyle = '#333';
  ctx.fillText(label, data.x + 8, data.y - 8);
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
      color: '#5c6bc0'
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

