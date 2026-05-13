/**
 * MÓDULO: Admin Authentication
 * Descripción: Gestiona la autenticación del panel administrativo
 * Responsabilidades:
 *   - Validación de credenciales
 *   - Almacenamiento de token en localStorage
 *   - Redirección a panel admin
 *   - Método de logout
 */

const adminLoginForm = document.getElementById('adminLoginForm');
const adminUser = document.getElementById('adminUser');
const adminPassword = document.getElementById('adminPassword');
const adminLoginError = document.getElementById('adminLoginError');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const loadingSpinner = document.querySelector('.loading-spinner');

// Credenciales de administrador (en producción, esto debería estar en el servidor)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

/**
 * Valida las credenciales contra el servidor o configuración local
 * @param {string} user - Usuario ingresado
 * @param {string} pass - Contraseña ingresada
 * @returns {boolean} True si las credenciales son válidas
 */
function validateCredentials(user, pass) {
  return user === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password;
}

/**
 * Muestra el spinner de carga
 */
function showSpinner() {
  loadingSpinner.style.display = 'inline-block';
}

/**
 * Oculta el spinner de carga
 */
function hideSpinner() {
  loadingSpinner.style.display = 'none';
}

/**
 * Muestra mensaje de error en el formulario
 * @param {string} message - Mensaje de error
 */
function showLoginError(message) {
  adminLoginError.textContent = message;
  adminLoginError.classList.remove('d-none');
}

/**
 * Oculta el mensaje de error
 */
function hideLoginError() {
  adminLoginError.classList.add('d-none');
}

/**
 * Almacena el token de autenticación en localStorage
 * @param {string} token - Token a almacenar
 */
function saveAdminToken(token) {
  localStorage.setItem('adminToken', token);
  localStorage.setItem('adminTokenTime', Date.now().toString());
}

/**
 * Recupera el token de autenticación de localStorage
 * @returns {string|null} Token almacenado o null si no existe
 */
function getAdminToken() {
  return localStorage.getItem('adminToken');
}

/**
 * EVENT: Submit del formulario de login
 * Valida credenciales y redirige al panel admin si son correctas
 */
adminLoginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const user = adminUser.value.trim();
  const pass = adminPassword.value;

  hideLoginError();

  if (!user || !pass) {
    showLoginError('Ambos campos son requeridos');
    return;
  }

  showSpinner();

  // Simular validación (en producción, hacer una petición al servidor)
  setTimeout(() => {
    if (validateCredentials(user, pass)) {
      const token = btoa(user + ':' + pass + ':' + Date.now());
      saveAdminToken(token);
      window.location.href = '/admin';
    } else {
      hideSpinner();
      showLoginError('Usuario o contraseña incorrectos');
      adminPassword.value = '';
      adminPassword.focus();
    }
  }, 500);
});

/**
 * EVENT: Click en botón "Volver a Inicio"
 * Retorna a la página principal sin autenticar
 */
backToHomeBtn.addEventListener('click', () => {
  window.location.href = '/';
});

