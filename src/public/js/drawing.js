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
let strokeStyle = 'solid'; // 'solid', 'dashed', 'dotted'
  let isDrawing = false;
  let lastPoint = null;
  // Identificador del trazo actual (agrupa múltiples segmentos en una acción)
  let currentStrokeId = null;
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
  }, 300);
}

/**
 * Dibuja un punto en el canvas local
 * @param {object} data - Datos del punto { x, y, color, size }
 * @param {string} label - Nombre del usuario que dibuja
 */
function renderPoint(data, label) {
  if (!ctx) return;

  if (data && Number.isFinite(data.fromX) && Number.isFinite(data.fromY)) {
    drawStrokeSegment(data);
  } else {
    ctx.fillStyle = data.color;
    ctx.beginPath();
    ctx.arc(data.x, data.y, data.size || 5, 0, Math.PI * 2);
    ctx.fill();
  }

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
  ctx.setLineDash([]);
}

/**
 * Reproduce el historial completo del canvas para reconstruir el lienzo
 * @param {array} history - Lista de acciones a pintar de nuevo
 */
function renderCanvasHistory(history) {
  clearCanvas();

  if (!Array.isArray(history)) return;

  history.forEach((item) => {
    if (!item) return;
    if (item.__type === 'clear-canvas') {
      clearCanvas();
      return;
    }

    if (item.__type === 'flood-fill') {
      floodFill(item.x, item.y, item.color);
      return;
    }

    // Nuevo: soporte para acciones agrupadas de trazo
    if (item.__type === 'stroke' && item.stroke && Array.isArray(item.stroke.segments)) {
      // Dibujar cada segmento del trazo en orden
      item.stroke.segments.forEach(seg => {
        drawStrokeSegment(seg);
      });
      return;
    }

    renderPoint(item, null);
  });
}

/**
 * Habilita o deshabilita los botones de deshacer y rehacer
 * @param {object} state - Estado con canUndo y canRedo
 */
function updateHistoryControls(state) {
  const toolUndo = document.getElementById('toolUndo');
  const toolRedo = document.getElementById('toolRedo');

  if (toolUndo) toolUndo.disabled = !state || !state.canUndo;
  if (toolRedo) toolRedo.disabled = !state || !state.canRedo;
}

/**
 * Devuelve el patrón de trazo según el estilo actual
 * @param {string} style - solid, dashed o dotted
 * @param {number} size - Grosor del pincel
 * @returns {number[]} Patrón para setLineDash
 */
function getLineDashPattern(style, size) {
  if (style === 'dashed') return [size * 3, size * 2];
  if (style === 'dotted') return [1, size * 2];
  return [];
}

/**
 * Dibuja un segmento de línea en el canvas
 * @param {object} data - Datos del segmento
 */
function drawStrokeSegment(data) {
  if (!ctx) return;

  const fromX = Number.isFinite(data.fromX) ? data.fromX : data.x;
  const fromY = Number.isFinite(data.fromY) ? data.fromY : data.y;
  const toX = Number.isFinite(data.x) ? data.x : fromX;
  const toY = Number.isFinite(data.y) ? data.y : fromY;
  const lineWidth = data.size || brushSize;

  ctx.save();
  ctx.strokeStyle = data.color || window.brushColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(getLineDashPattern(data.style || strokeStyle, lineWidth));
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();
}

/**
 * Exporta el canvas actual como JPG
 */
function exportCanvasAsImage() {
  const link = document.createElement('a');
  link.download = 'drawnow-pizarra.jpg';
  link.href = canvas.toDataURL('image/jpeg', 0.92);
  link.click();
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
      // Iniciar un nuevo trazo agrupado
      isDrawing = true;
      lastPoint = { x, y };
      currentStrokeId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

      const meta = {
        strokeId: currentStrokeId,
        color: currentTool === 'eraser' ? '#ffffff' : window.brushColor,
        size: brushSize,
        style: strokeStyle,
        tool: currentTool
      };

      const drawData = {
        strokeId: currentStrokeId,
        fromX: x,
        fromY: y,
        x,
        y,
        color: meta.color,
        size: meta.size,
        style: meta.style,
        tool: meta.tool
      };

      // Notificar inicio de trazo al servidor para que agrupe la acción
      socket.emit('draw-start', { strokeId: currentStrokeId, meta, point: { x, y } });
      renderPoint(drawData, 'Yo');
      socket.emit('draw-data', drawData);
    }
  });

  // Evento Mousemove para arrastrar el trazo continuo
  canvas.addEventListener('mousemove', (e) => {
    if (e.buttons !== 1 || !isDrawing) return;
    if (currentTool === 'bucket') return;
    if (typeof currentRoomId === 'undefined' || !currentRoomId) return;

    const rect = canvas.getBoundingClientRect();
    const drawData = {
      strokeId: currentStrokeId,
      fromX: lastPoint ? lastPoint.x : Math.round(e.clientX - rect.left),
      fromY: lastPoint ? lastPoint.y : Math.round(e.clientY - rect.top),
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
      color: currentTool === 'eraser' ? '#ffffff' : window.brushColor,
      size: brushSize,
      style: strokeStyle,
      tool: currentTool
    };

    renderPoint(drawData, 'Yo');
    socket.emit('draw-data', drawData);
    lastPoint = { x: drawData.x, y: drawData.y };
  });

  canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    lastPoint = null;

    // Finalizar trazo agrupado y notificar al servidor
    if (currentStrokeId) {
      socket.emit('draw-end', { strokeId: currentStrokeId });
      currentStrokeId = null;
    }

    // Ocultar todos los cursores
    Object.keys(activeCursors).forEach(user => {
      const cursor = activeCursors[user];
      if (cursor && cursor.el) {
        cursor.el.style.opacity = '0';
        if (cursor.timeout) clearTimeout(cursor.timeout);
        cursor.timeout = setTimeout(() => {
          if (cursor.el.parentNode) cursor.el.parentNode.removeChild(cursor.el);
          delete activeCursors[user];
        }, 200);
      }
    });
  });

canvas.addEventListener('mouseleave', () => {
  isDrawing = false;
  lastPoint = null;
  if (currentStrokeId) {
    socket.emit('draw-end', { strokeId: currentStrokeId });
    currentStrokeId = null;
  }
  // Ocultar al salir del canvas
  Object.keys(activeCursors).forEach(user => {
    const cursor = activeCursors[user];
    if (cursor && cursor.el) {
      cursor.el.style.opacity = '0';
      if (cursor.timeout) clearTimeout(cursor.timeout);
      cursor.timeout = setTimeout(() => {
        if (cursor.el.parentNode) cursor.el.parentNode.removeChild(cursor.el);
        delete activeCursors[user];
      }, 200);
    }
  });
});

  // ---- VINCULACIÓN DE CONTROLES DE LA INTERFAZ DE HERRAMIENTAS ----
  const colorPicker = document.getElementById('colorPicker');
  const brushSizeInput = document.getElementById('brushSize');
  const brushSizeVal = document.getElementById('brushSizeVal');
  const strokeStyleSelect = document.getElementById('strokeStyle');
  const toolBrush = document.getElementById('toolBrush');
  const toolEraser = document.getElementById('toolEraser');
  const toolBucket = document.getElementById('toolBucket');
  const toolClear = document.getElementById('toolClear');
  const toolExport = document.getElementById('toolExport');
  const toolUndo = document.getElementById('toolUndo');
  const toolRedo = document.getElementById('toolRedo');

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

  if (strokeStyleSelect) {
    strokeStyleSelect.addEventListener('change', (e) => {
      strokeStyle = e.target.value;
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

  if (toolExport) {
    toolExport.addEventListener('click', exportCanvasAsImage);
  }

  if (toolUndo) {
    toolUndo.addEventListener('click', () => {
      socket.emit('undo-drawing', (response) => {
        if (!response || !response.success) {
          alert((response && response.message) || 'No se pudo deshacer la acción');
        }
      });
    });
  }

  if (toolRedo) {
    toolRedo.addEventListener('click', () => {
      socket.emit('redo-drawing', (response) => {
        if (!response || !response.success) {
          alert((response && response.message) || 'No se pudo rehacer la acción');
        }
      });
    });
  }

  updateHistoryControls(null);
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

