// Capturar token de Google OAuth antes de cualquier otra cosa
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');
const usernameFromUrl = urlParams.get('username');

if (tokenFromUrl && usernameFromUrl) {
  localStorage.setItem('token', tokenFromUrl);
  localStorage.setItem('username', usernameFromUrl);
  window.history.replaceState({}, document.title, '/');
}

const token = localStorage.getItem('token');

if (!token) {
  window.location.href = '/login';
}

const socket = io({ auth: { token } });

// Manejar error de autenticación del socket
socket.on('connect_error', (err) => {
  if (err.message === 'No autenticado' || err.message === 'Token inválido') {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  }
});

let currentUser = null;
let currentRoom = null;
let currentRoomId = null;
let allRooms = [];

const homeScreen = document.getElementById('homeScreen');
const loginScreen = document.getElementById('loginScreen');
const roomsScreen = document.getElementById('roomsScreen');
const drawScreen = document.getElementById('drawScreen');

const userAccessBtn = document.getElementById('userAccessBtn');
const adminAccessBtn = document.getElementById('adminAccessBtn');
const backFromLoginBtn = document.getElementById('backFromLoginBtn');

const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const loginError = document.getElementById('loginError');

const userDisplay = document.getElementById('userDisplay');
const roomNameDisplay = document.getElementById('roomNameDisplay');
const participantsDisplay = document.getElementById('participantsDisplay');
const roomsList = document.getElementById('roomsList');
const noRoomsSection = document.getElementById('noRoomsSection');
const roomsListSection = document.getElementById('roomsListSection');

document.addEventListener('DOMContentLoaded', () => {
  const savedUsername = localStorage.getItem('username');
  if (savedUsername) {
    currentUser = savedUsername;
    if (userDisplay) {
      userDisplay.textContent = 'Usuario: ' + currentUser;
    }
    socket.emit('list-rooms');
    showScreen(roomsScreen);
  }
});

if (userAccessBtn) {
  userAccessBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (token) {
      showScreen(roomsScreen);
    } else {
      window.location.href = '/login';
    }
  });
}

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('d-none'));
  screen.classList.remove('d-none');
  if (screen === drawScreen) {
    resizeCanvas();
  }
}

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('d-none');
  setTimeout(() => loginError.classList.add('d-none'), 3000);
}

adminAccessBtn.addEventListener('click', () => {
  window.location.href = '/auth/admin';
});

backFromLoginBtn.addEventListener('click', () => {
  usernameInput.value = '';
  loginError.classList.add('d-none');
  showScreen(homeScreen);
});

// Este formulario ya no se usa para login real (es el socket login viejo)
// Lo dejamos por si el HTML lo necesita pero no hace nada crítico
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
  });
}

socket.on('rooms-list-updated', (data) => {
  allRooms = data.rooms;
  if (currentUser && !currentRoomId) {
    updateRoomsList();
    showScreen(roomsScreen);
  }
});

function updateRoomsList() {
  if (allRooms.length === 0) {
    noRoomsSection.classList.remove('d-none');
    roomsListSection.classList.add('d-none');
  } else {
    noRoomsSection.classList.add('d-none');
    roomsListSection.classList.remove('d-none');

    roomsList.innerHTML = allRooms.map(room => `
      <div class="col-md-6">
        <div class="card card-room">
          <div class="card-body">
            <h5 class="card-title">${room.name}</h5>
            <p class="card-text">
              <small class="text-muted">
                ${room.participantCount} usuario(s) | Por ${room.createdBy}
              </small>
            </p>
            <button class="btn btn-primary btn-sm" onclick="joinRoom(${room.id})">
              Ingresar
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

const createRoomModalElement = document.getElementById('createRoomModal');
const createRoomModal = new bootstrap.Modal(createRoomModalElement);

function openCreateRoomModal() {
  createRoomModal.show();
}

document.getElementById('createRoomBtnMain').addEventListener('click', openCreateRoomModal);
document.getElementById('createRoomBtnCorner').addEventListener('click', openCreateRoomModal);

document.getElementById('confirmCreateRoom').addEventListener('click', () => {
  const roomName = document.getElementById('roomNameInput').value.trim() || 'Sin nombre';
  socket.emit('create-room', { roomName }, (response) => {
    if (response.success) {
      document.getElementById('roomNameInput').value = '';
      createRoomModal.hide();
    } else {
      alert(response.message || 'No se pudo crear la sala');
    }
  });
});

function joinRoom(roomId) {
  socket.emit('join-room', { roomId }, (response) => {
    if (response.success) {
      currentRoomId = response.room.id;
      currentRoom = response.room;
      roomNameDisplay.textContent = response.room.name;
      updateParticipants();
      showScreen(drawScreen);
    } else {
      alert(response.message || 'Error al ingresar a la sala');
    }
  });
}

function updateParticipants() {
  if (currentRoom) {
    const participants = currentRoom.participants.map(p => p.username).join(', ');
    participantsDisplay.textContent = participants;
  }
}

socket.on('user-joined', (data) => {
  if (currentRoomId) {
    participantsDisplay.textContent = data.participants.join(', ');
  }
});

socket.on('user-left', (data) => {
  if (currentRoomId) {
    participantsDisplay.textContent = data.participants.join(', ');
  }
});

document.getElementById('leaveRoomBtn').addEventListener('click', () => {
  socket.emit('leave-room', { roomId: currentRoomId }, (response) => {
    if (response && response.success) {
      currentRoomId = null;
      currentRoom = null;
      clearCanvas();
      if (typeof updateHistoryControls === 'function') updateHistoryControls(null);
      socket.emit('list-rooms');
    } else {
      alert((response && response.message) || 'No se pudo salir de la sala');
    }
  });
});

document.getElementById('deleteRoomBtn').addEventListener('click', () => {
  if (confirm('Seguro que deseas eliminar esta sala?')) {
    socket.emit('delete-room', { roomId: currentRoomId }, (response) => {
      if (response.success) {
        alert('Sala eliminada');
        currentRoomId = null;
        currentRoom = null;
        clearCanvas();
        if (typeof updateHistoryControls === 'function') updateHistoryControls(null);
        socket.emit('list-rooms');
      } else {
        alert((response && response.message) || 'No se pudo eliminar la sala');
      }
    });
  }
});

socket.on('render-draw', (data) => {
  renderPoint(data, data.user);
});

socket.on('canvas-cleared', () => {
  clearCanvas();
});

socket.on('render-flood-fill', (data) => {
  if (typeof floodFill === 'function') {
    floodFill(data.x, data.y, data.color);
  }
});

socket.on('room-deleted', () => {
  if (currentRoomId) {
    alert('La sala fue eliminada');
    currentRoomId = null;
    currentRoom = null;
    clearCanvas();
    if (typeof updateHistoryControls === 'function') updateHistoryControls(null);
    socket.emit('list-rooms');
  }
});

socket.on('kicked-from-room', (data) => {
  currentRoomId = null;
  currentRoom = null;
  clearCanvas();
  if (typeof updateHistoryControls === 'function') updateHistoryControls(null);
  alert(data && data.message ? data.message : 'Has sido expulsado de la sala');
  socket.emit('list-rooms');
  showScreen(roomsScreen);
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  socket.emit('logout-user');
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  currentUser = null;
  currentRoomId = null;
  currentRoom = null;
  clearCanvas();
  if (typeof updateHistoryControls === 'function') updateHistoryControls(null);
  window.location.href = '/login';
});

socket.on('canvas-history', (history) => {
  renderCanvasHistory(history);
});

socket.on('history-state-updated', (state) => {
  if (typeof updateHistoryControls === 'function') updateHistoryControls(state);
});

showScreen(homeScreen);