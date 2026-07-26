function getAdminToken() {
  return localStorage.getItem('adminToken');
}

const adminToken = getAdminToken();
if (!adminToken) {
  window.location.href = '/login';
}

try {
  const payload = JSON.parse(atob(adminToken.split('.')[1]));
  if (payload.username !== 'admin') {
    window.location.href = '/login';
  }
} catch (e) {
  window.location.href = '/login';
}

const socket = io({ auth: { token: adminToken } });

const totalUsersElement = document.getElementById('totalUsers');
const totalRoomsElement = document.getElementById('totalRooms');
const lastUpdateElement = document.getElementById('lastUpdate');
const roomsDetailsElement = document.getElementById('roomsDetails');
const noRoomsMessageElement = document.getElementById('noRoomsMessage');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminUserDisplay = document.getElementById('adminUserDisplay');
const logConsole = document.getElementById('logConsole');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const globalAlertInput = document.getElementById('globalAlertInput');
const sendGlobalAlertBtn = document.getElementById('sendGlobalAlertBtn');

const logCountInfo = document.getElementById('logCountInfo');
const logCountWarn = document.getElementById('logCountWarn');
const logCountError = document.getElementById('logCountError');

let logCounters = { info: 0, warn: 0, error: 0 };

adminUserDisplay.textContent = 'Admin: admin';

function updateStatistics(data) {
  totalUsersElement.textContent = data.totalConnectedUsers || 0;
  totalRoomsElement.textContent = data.totalRooms || 0;
  lastUpdateElement.textContent = new Date().toLocaleTimeString('es-ES');

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

socket.on('user-stats-updated', updateStatistics);

setInterval(async () => {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    updateStatistics(data);
  } catch (err) {
    appendLog('error', 'Error fetching stats: ' + err.message);
  }
}, 2000);

adminLogoutBtn.addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('token');
  window.location.href = '/login';
});

clearLogsBtn.addEventListener('click', () => {
  logConsole.innerHTML = '<div class="log-line log-info">[SISTEMA] Consola limpiada.</div>';
});

if (sendGlobalAlertBtn) {
  sendGlobalAlertBtn.addEventListener('click', async () => {
    const message = globalAlertInput ? globalAlertInput.value.trim() : '';
    if (!message) {
      appendLog('warn', 'Debes escribir un mensaje para la alerta global.');
      return;
    }

    sendGlobalAlertBtn.disabled = true;
    try {
      const response = await fetch('/api/broadcast-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + adminToken
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        appendLog('error', 'Error enviando alerta global: ' + (data.message || 'desconocido'));
        return;
      }

      appendLog('info', 'Alerta global publicada: ' + message);
      if (globalAlertInput) globalAlertInput.value = '';
    } catch (err) {
      appendLog('error', 'Fallo de red enviando alerta global: ' + err.message);
    } finally {
      sendGlobalAlertBtn.disabled = false;
    }
  });
}

function appendLog(level, message) {
  const line = document.createElement('div');
  const now = new Date().toLocaleTimeString('es-ES');
  const levelUpper = level.toUpperCase();

  line.className = 'log-line';

  if (level === 'error' || level === 'fatal') {
    line.classList.add('log-error');
    line.innerHTML = `<span class="log-time">${now}</span> <span class="log-badge badge-error">${levelUpper}</span> ${message}`;
    logCounters.error++;
    logCountError.textContent = logCounters.error;
  } else if (level === 'warn') {
    line.classList.add('log-warn');
    line.innerHTML = `<span class="log-time">${now}</span> <span class="log-badge badge-warn">${levelUpper}</span> ${message}`;
    logCounters.warn++;
    logCountWarn.textContent = logCounters.warn;
  } else {
    line.classList.add('log-info');
    line.innerHTML = `<span class="log-time">${now}</span> <span class="log-badge badge-info">${levelUpper}</span> ${message}`;
    logCounters.info++;
    logCountInfo.textContent = logCounters.info;
  }

  logConsole.appendChild(line);
  logConsole.scrollTop = logConsole.scrollHeight;

  if (logConsole.children.length > 500) {
    logConsole.removeChild(logConsole.firstChild);
  }
}

socket.on('admin-log', (data) => {
  appendLog(data.level, data.message);
});

socket.on('global-alert', (data) => {
  const msg = data && data.message ? data.message : 'Alerta recibida';
  appendLog('warn', 'ALERTA GLOBAL ENTREGADA: ' + msg);
});

socket.on('room-persisted', (data) => {
  const action = data && data.action ? data.action : 'unknown';
  const roomName = data && data.nombre ? data.nombre : 'sin-nombre';
  appendLog('info', 'Persistencia confirmada (' + action + ') para sala: ' + roomName);
});

window.deleteRoom = (roomId) => {
  if (confirm('¿Seguro que deseas eliminar esta sala?')) {
    socket.emit('delete-room-admin', { roomId }, (response) => {
      if (response.success) {
        appendLog('info', 'Sala ' + roomId + ' eliminada por admin.');
      } else {
        appendLog('warn', 'No se pudo eliminar sala ' + roomId + ': ' + (response.message || ''));
      }
    });
  }
};

window.kickUser = (roomId, socketId) => {
  if (confirm('¿Quieres sacar a este usuario de la sala?')) {
    socket.emit('kick-user-admin', { roomId, socketId }, (response) => {
      if (response.success) {
        appendLog('info', 'Usuario expulsado de sala ' + roomId);
      } else {
        appendLog('warn', 'No se pudo expulsar usuario: ' + (response.message || ''));
      }
    });
  }
};

socket.on('connect_error', (err) => {
  appendLog('error', 'Error de conexión Socket.io: ' + err.message);
});
