/**
 * MÓDULO: User Flow
 * Descripción: Gestiona el flujo de usuario (login, salas, dibujo)
 * Responsabilidades:
 *   - Autenticación del usuario
 *   - Gestión de pantallas (home, login, rooms, draw)
 *   - Creación y unión a salas
 *   - Manejo de participantes en tiempo real
 *   - Salida y eliminación de salas
 */

const socket = io();

// Estado global del usuario
let currentUser = null;
let currentRoom = null;
let currentRoomId = null;
let allRooms = [];

// Elementos del DOM
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

/**
 * Alterna entre pantallas ocultando todas excepto la especificada
 * @param {HTMLElement} screen - Elemento de pantalla a mostrar
 */
function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('d-none'));
  screen.classList.remove('d-none');

  if (screen === drawScreen) {
    resizeCanvas();
  }
}

/**
 * Muestra mensaje de error temporal en el formulario de login
 * @param {string} message - Mensaje de error a mostrar
 */
function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('d-none');
  setTimeout(() => loginError.classList.add('d-none'), 3000);
}

/**
 * EVENT: Click en botón "Acceso Usuario"
 * Muestra la pantalla de login y enfoca el input de nombre
 */
userAccessBtn.addEventListener('click', () => {
  showScreen(loginScreen);
  usernameInput.focus();
});

/**
 * EVENT: Click en botón "Panel Administrador"
 * Redirige a la página de login del administrador
 */
adminAccessBtn.addEventListener('click', () => {
  window.location.href = '/auth/admin';
});

/**
 * EVENT: Click en botón "Volver"
 * Retorna a la pantalla de inicio y limpia el formulario
 */
backFromLoginBtn.addEventListener('click', () => {
  usernameInput.value = '';
  loginError.classList.add('d-none');
  showScreen(homeScreen);
});

/**
 * EVENT: Submit del formulario de login
 * Emite evento de login al servidor con validación local
 */
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();

  if (!username) {
    showError('El nombre es requerido');
    return;
  }

  socket.emit('login', { username }, (response) => {
    if (response.success) {
      currentUser = username;
      currentUserColor = response.color || '#5c6bc0';
      userDisplay.textContent = 'Usuario: ' + username;
      userDisplay.style.color = currentUserColor;

      // Sincronizar colorPicker con el color único asignado por el servidor
      const colorPicker = document.getElementById('colorPicker');
      if (colorPicker) colorPicker.value = currentUserColor;
      if (typeof brushColor !== 'undefined') brushColor = currentUserColor;

      usernameInput.value = '';
      socket.emit('list-rooms');
    } else {
      showError(response.message || 'Error en la conexión');
    }
  });
});

/**
 * EVENT SOCKET: rooms-list-updated
 * Se ejecuta cuando la lista de salas se actualiza
 * Muestra la pantalla de salas si el usuario está logueado
 */
socket.on('rooms-list-updated', (data) => {
  allRooms = data.rooms;

  if (currentUser && !currentRoomId) {
    updateRoomsList();
    showScreen(roomsScreen);
  }
});

/**
 * Actualiza la interfaz de la lista de salas
 * Muestra salas disponibles o mensaje si no hay salas
 */
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

// Modal de crear sala
const createRoomModal = new bootstrap.Modal('#createRoomModal');

/**
 * Abre el modal para crear una nueva sala
 */
function openCreateRoomModal() {
  createRoomModal.show();
}

document.getElementById('createRoomBtnMain').addEventListener('click', openCreateRoomModal);
document.getElementById('createRoomBtnCorner').addEventListener('click', openCreateRoomModal);

/**
 * EVENT: Click en botón "Crear" del modal
 * Emite evento para crear nueva sala
 */
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

/**
 * Une al usuario a una sala específica
 * @param {number} roomId - ID de la sala a unirse
 */
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

/**
 * Actualiza la lista de participantes en la interfaz
 */
function updateParticipants() {
  if (currentRoom) {
    const participants = currentRoom.participants.map(p => p.username).join(', ');
    participantsDisplay.textContent = participants;
  }
}

/**
 * EVENT SOCKET: user-joined
 * Se ejecuta cuando un usuario entra a la sala actual
 */
socket.on('user-joined', (data) => {
  if (currentRoomId) {
    participantsDisplay.textContent = data.participants.join(', ');
  }
});

/**
 * EVENT SOCKET: user-left
 * Se ejecuta cuando un usuario sale de la sala actual
 */
socket.on('user-left', (data) => {
  if (currentRoomId) {
    participantsDisplay.textContent = data.participants.join(', ');
  }
});

/**
 * EVENT: Click en botón "Salir de Sala"
 * Retira al usuario de la sala actual y vuelve a la lista
 */
document.getElementById('leaveRoomBtn').addEventListener('click', () => {
  socket.emit('leave-room', { roomId: currentRoomId }, (response) => {
    if (response && response.success) {
      currentRoomId = null;
      currentRoom = null;
      clearCanvas();
      socket.emit('list-rooms');
    } else {
      alert((response && response.message) || 'No se pudo salir de la sala');
    }
  });
});

/**
 * EVENT: Click en botón "Eliminar Sala"
 * Intenta eliminar la sala (solo si no hay otros participantes)
 */
document.getElementById('deleteRoomBtn').addEventListener('click', () => {
  if (confirm('Seguro que deseas eliminar esta sala?')) {
    socket.emit('delete-room', { roomId: currentRoomId }, (response) => {
      if (response.success) {
        alert('Sala eliminada');
        currentRoomId = null;
        currentRoom = null;
        clearCanvas();
        socket.emit('list-rooms');
      } else {
        alert((response && response.message) || 'No se pudo eliminar la sala');
      }
    });
  }
});

/**
 * EVENT SOCKET: render-draw
 * Se ejecuta cuando otro usuario dibuja en la sala
 */
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

/**
 * EVENT SOCKET: room-deleted
 * Se ejecuta cuando la sala actual es eliminada por el servidor
 */
socket.on('room-deleted', () => {
  if (currentRoomId) {
    alert('La sala fue eliminada');
    currentRoomId = null;
    currentRoom = null;
    clearCanvas();
    socket.emit('list-rooms');
  }
});

/**
 * EVENT: Click en botón "Salir" (logout)
 * Cierra la sesión del usuario y retorna al inicio
 */
document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  currentRoomId = null;
  currentRoom = null;
  clearCanvas();
  showScreen(homeScreen);
});

/**
 * Inicialización: Mostrar pantalla de inicio
 */
showScreen(homeScreen);

