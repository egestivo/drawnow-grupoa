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

// Variables de configuración de herramientas de dibujo
let currentTool = 'brush'; // 'brush', 'eraser', 'bucket'
let brushSize = 5;
window.brushColor = '#5c6bc0'; // Exponerlo globalmente para sincronización

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
 * @param {object} data - Datos del punto { x, y, color, size }
 * @param {string} label - Nombre del usuario que dibuja
 */
function renderPoint(data, label) {
  if (!ctx) return;

  ctx.fillStyle = data.color;
  ctx.beginPath();
  ctx.arc(data.x, data.y, data.size || 5, 0, Math.PI * 2);
  ctx.fill();

  // Actualizar el cursor dinámico flotante si el trazo es de otro usuario
  if (label && label !== 'Yo') {
    updateFloatingCursor(label, data.x, data.y, data.color);
  }
}

/**
 * Algoritmo Flood Fill (Bote de Pintura) - Relleno recursivo usando pila
 */
function floodFill(startX, startY, fillHexColor) {
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const fillRgb = hexToRgb(fillHexColor);
  if (!fillRgb) return;

  const targetIndex = (startY * width + startX) * 4;
  const targetR = data[targetIndex];
  const targetG = data[targetIndex + 1];
  const targetB = data[targetIndex + 2];
  const targetA = data[targetIndex + 3];

  // Si el color objetivo ya es igual al color de relleno, salir
  if (
    targetR === fillRgb.r &&
    targetG === fillRgb.g &&
    targetB === fillRgb.b &&
    targetA === fillRgb.a
  ) {
    return;
  }

  const queue = [[startX, startY]];

  while (queue.length > 0) {
    const [cx, cy] = queue.pop();
    const idx = (cy * width + cx) * 4;

    if (
      cx >= 0 && cx < width &&
      cy >= 0 && cy < height &&
      data[idx] === targetR &&
      data[idx + 1] === targetG &&
      data[idx + 2] === targetB &&
      data[idx + 3] === targetA
    ) {
      data[idx] = fillRgb.r;
      data[idx + 1] = fillRgb.g;
      data[idx + 2] = fillRgb.b;
      data[idx + 3] = fillRgb.a;

      queue.push([cx + 1, cy]);
      queue.push([cx - 1, cy]);
      queue.push([cx, cy + 1]);
      queue.push([cx, cy - 1]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Utilidad de conversión Hex a RGBA
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: 255
  } : null;
}

/**
 * Limpia todo el contenido del canvas
 */
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Configura los eventos de dibujo al presionar y mover el mouse
 * Soporta pincel, borrador, bote de pintura y controles de UI
 */
function setupDrawing() {
  // Evento Mousedown para habilitar clic único o bote de pintura
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Solo clic izquierdo
    if (typeof currentRoomId === 'undefined' || !currentRoomId) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    if (currentTool === 'bucket') {
      floodFill(x, y, window.brushColor);
      socket.emit('flood-fill', { x, y, color: window.brushColor });
    } else {
      const drawData = {
        x,
        y,
        color: currentTool === 'eraser' ? '#ffffff' : window.brushColor,
        size: brushSize
      };
      renderPoint(drawData, 'Yo');
      socket.emit('draw-data', drawData);
    }
  });

  // Evento Mousemove para arrastrar el trazo continuo
  canvas.addEventListener('mousemove', (e) => {
    if (e.buttons !== 1) return;
    if (currentTool === 'bucket') return;
    if (typeof currentRoomId === 'undefined' || !currentRoomId) return;

    const rect = canvas.getBoundingClientRect();
    const drawData = {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
      color: currentTool === 'eraser' ? '#ffffff' : window.brushColor,
      size: brushSize
    };

    renderPoint(drawData, 'Yo');
    socket.emit('draw-data', drawData);
  });

  // ---- VINCULACIÓN DE CONTROLES DE LA INTERFAZ DE HERRAMIENTAS ----
  const colorPicker = document.getElementById('colorPicker');
  const brushSizeInput = document.getElementById('brushSize');
  const brushSizeVal = document.getElementById('brushSizeVal');
  const toolBrush = document.getElementById('toolBrush');
  const toolEraser = document.getElementById('toolEraser');
  const toolBucket = document.getElementById('toolBucket');
  const toolClear = document.getElementById('toolClear');

  // Escuchar cambios de color
  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      window.brushColor = e.target.value;
      if (currentTool === 'eraser') {
        selectTool('brush');
      }
    });
  }

  // Escuchar cambios de grosor
  if (brushSizeInput) {
    brushSizeInput.addEventListener('input', (e) => {
      brushSize = parseInt(e.target.value);
      if (brushSizeVal) brushSizeVal.textContent = brushSize;
    });
  }

  // Seleccionar herramientas
  function selectTool(tool) {
    currentTool = tool;
    if (toolBrush) toolBrush.className = tool === 'brush' ? 'btn btn-sm btn-primary tool-btn' : 'btn btn-sm btn-outline-secondary tool-btn';
    if (toolEraser) toolEraser.className = tool === 'eraser' ? 'btn btn-sm btn-primary tool-btn' : 'btn btn-sm btn-outline-secondary tool-btn';
    if (toolBucket) toolBucket.className = tool === 'bucket' ? 'btn btn-sm btn-primary tool-btn' : 'btn btn-sm btn-outline-secondary tool-btn';
  }

  if (toolBrush) toolBrush.addEventListener('click', () => selectTool('brush'));
  if (toolEraser) toolEraser.addEventListener('click', () => selectTool('eraser'));
  if (toolBucket) toolBucket.addEventListener('click', () => selectTool('bucket'));

  // Acción de limpiar todo el lienzo colaborativo
  if (toolClear) {
    toolClear.addEventListener('click', () => {
      if (confirm('¿Seguro que deseas limpiar la pizarra?')) {
        clearCanvas();
        socket.emit('clear-canvas');
      }
    });
  }
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

