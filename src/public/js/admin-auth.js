const adminLoginForm = document.getElementById('adminLoginForm');
const adminUser = document.getElementById('adminUser');
const adminPassword = document.getElementById('adminPassword');
const adminLoginError = document.getElementById('adminLoginError');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const loadingSpinner = document.querySelector('.loading-spinner');

function showSpinner() {
  loadingSpinner.style.display = 'inline-block';
  adminLoginBtn.disabled = true;
}

function hideSpinner() {
  loadingSpinner.style.display = 'none';
  adminLoginBtn.disabled = false;
}

function showLoginError(message) {
  adminLoginError.textContent = message;
  adminLoginError.classList.remove('d-none');
}

function hideLoginError() {
  adminLoginError.classList.add('d-none');
}

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const user = adminUser.value.trim();
  const pass = adminPassword.value;

  hideLoginError();

  if (!user || !pass) {
    showLoginError('Ambos campos son requeridos');
    return;
  }

  showSpinner();

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });

    const data = await response.json();

    if (!data.success) {
      hideSpinner();
      showLoginError(data.message || 'Credenciales inválidas');
      adminPassword.value = '';
      adminPassword.focus();
      return;
    }

    if (data.user.username !== 'admin') {
      hideSpinner();
      showLoginError('Acceso denegado: solo el usuario admin puede ingresar');
      adminPassword.value = '';
      adminPassword.focus();
      return;
    }

    localStorage.setItem('adminToken', data.token);

    try {
      const payload = JSON.parse(atob(data.token.split('.')[1]));
      if (payload.username === 'admin') {
        window.location.href = '/admin';
      } else {
        hideSpinner();
        showLoginError('Token inválido para administrador');
      }
    } catch (e) {
      hideSpinner();
      showLoginError('Error al procesar la autenticación');
    }

  } catch (err) {
    hideSpinner();
    showLoginError('Error de conexión con el servidor');
  }
});

backToHomeBtn.addEventListener('click', () => {
  window.location.href = '/';
});
