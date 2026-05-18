/**
 * MÓDULO: Admin Panel
 * Descripción: Gestiona el panel de administración con estadísticas en tiempo real
 * Responsabilidades:
 *   - Mostrar estadísticas de usuarios y salas
 *   - Actualizar datos en tiempo real vía WebSocket y API REST
 *   - Proteger acceso con validación de token
 *   - Logout del administrador
 */

const socket = io();

// Elementos del DOM
const totalUsersElement = document.getElementById('totalUsers');
const totalRoomsElement = document.getElementById('totalRooms');
const lastUpdateElement = document.getElementById('lastUpdate');
const roomsDetailsElement = document.getElementById('roomsDetails');
const noRoomsMessageElement = document.getElementById('noRoomsMessage');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

/**
 * Verifica si el usuario tiene autenticación válida
 * Si no la tiene, redirige a la página de login del admin
 */
function checkAdminAuth() {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = '/auth/admin';
    return false;
  }
  return true;
}

/**
 * Actualiza la interfaz con las estadísticas recibidas
 * @param {object} data - Datos con información de salas y usuarios
 */
function updateStatistics(data) {
  // Actualizar contadores principales
  totalUsersElement.textContent = data.totalConnectedUsers || 0;
  totalRoomsElement.textContent = data.totalRooms || 0;
  lastUpdateElement.textContent = new Date().toLocaleTimeString('es-ES');

  // Actualizar lista de salas
  if (!data.rooms || data.rooms.length === 0) {
    roomsDetailsElement.innerHTML = '';
    noRoomsMessageElement.classList.remove('d-none');
  } else {
    noRoomsMessageElement.classList.add('d-none');
    roomsDetailsElement.innerHTML = data.rooms.map(room => `
      <div class="room-item">
        <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
          <div>
            <h6>${room.name}</h6>
            <small>Creada por: ${room.createdBy}</small>
            <div class="room-users">
              ${renderParticipants(room)}
            </div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="admin-badge">
              ${room.participantCount} usuario(s)
            </span>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteRoom(${room.id})">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

/**
 * Renderiza la lista de participantes de una sala para el panel admin
 * @param {object} room - Sala con participantes detallados
 * @returns {string} HTML de participantes
 */
function renderParticipants(room) {
  const participants = Array.isArray(room.participants) ? room.participants : [];

  if (participants.length === 0) {
    return '<small><strong>Participantes:</strong> ninguno</small>';
  }

  return `
    <div class="participants-list">
      <small class="participants-title"><strong>Participantes:</strong></small>
      ${participants.map(participant => {
        const username = participant.username || String(participant);
        const socketId = participant.socketId || '';

        return `
          <div class="participant-item">
            <span class="participant-name">${username}</span>
            ${socketId ? `<button class="btn btn-outline-warning btn-sm" onclick="kickUser(${room.id}, '${socketId}')">Sacar</button>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * EVENT SOCKET: user-stats-updated
 * Se recibe cuando hay cambios en salas o usuarios
 */
socket.on('user-stats-updated', updateStatistics);

/**
 * Actualiza estadísticas vía API REST cada 2 segundos
 * Proporciona actualización periódica independiente de WebSocket
 */
setInterval(async () => {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    updateStatistics(data);
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}, 2000);

/**
 * EVENT: Click en botón "Cerrar Sesión"
 * Elimina el token de autenticación y redirige a login del admin
 */
adminLogoutBtn.addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminTokenTime');
  window.location.href = '/auth/admin';
});

/**
 * Inicialización: Verificar autenticación
 */
if (!checkAdminAuth()) {
  throw new Error('No autorizado');
}

/**
 * Elimina una sala desde el panel de administración (solo si está vacía)
 * @param {number} roomId - ID de la sala a eliminar
 */
window.deleteRoom = (roomId) => {
  if (confirm('¿Seguro que deseas eliminar esta sala?')) {
    socket.emit('delete-room-admin', { roomId }, (response) => {
      if (response.success) {
        alert(response.message || 'Sala eliminada con éxito.');
      } else {
        alert(response.message || 'No se pudo eliminar la sala.');
      }
    });
  }
};

/**
 * Expulsa a un usuario de una sala desde el panel admin
 * @param {number} roomId - ID de la sala
 * @param {string} socketId - Socket del usuario
 */
window.kickUser = (roomId, socketId) => {
  if (confirm('¿Quieres sacar a este usuario de la sala?')) {
    socket.emit('kick-user-admin', { roomId, socketId }, (response) => {
      if (response.success) {
        alert(response.message || 'Usuario expulsado correctamente.');
      } else {
        alert(response.message || 'No se pudo expulsar al usuario.');
      }
    });
  }
};

