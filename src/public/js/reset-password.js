/**
 * MÓDULO: Reset Password
 * Descripción: Gestiona el flujo de recuperación de contraseña en el cliente.
 * Responsabilidades:
 *   - Detectar si hay un token en la URL para mostrar el formulario correcto
 *   - Solicitar generación de enlace de recuperación (forgot-password)
 *   - Enviar nueva contraseña al servidor con el token JWT (reset-password)
 */

document.addEventListener('DOMContentLoaded', () => {
  const forgotSection   = document.getElementById('forgotSection');
  const resetSection    = document.getElementById('resetSection');
  const forgotForm      = document.getElementById('forgotForm');
  const resetForm       = document.getElementById('resetForm');
  const forgotAlert     = document.getElementById('forgotAlert');
  const resetAlert      = document.getElementById('resetAlert');
  const resetLinkSection = document.getElementById('resetLinkSection');
  const resetLinkAnchor  = document.getElementById('resetLinkAnchor');
  const forgotBtn       = document.getElementById('forgotBtn');
  const resetBtn        = document.getElementById('resetBtn');

  // -------------------------------------------------------
  // Detectar si la URL tiene ?token=... para decidir qué mostrar
  // -------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');

  if (tokenFromUrl) {
    // Mostrar formulario de nueva contraseña
    forgotSection.classList.add('d-none');
    resetSection.classList.remove('d-none');
  } else {
    // Mostrar formulario de solicitud de enlace
    forgotSection.classList.remove('d-none');
    resetSection.classList.add('d-none');
  }

  // -------------------------------------------------------
  // Utilidades de UI
  // -------------------------------------------------------
  function showAlert(alertEl, type, message) {
    alertEl.className = `alert alert-${type}`;
    alertEl.textContent = message;
    alertEl.classList.remove('d-none');
  }

  function hideAlert(alertEl) {
    alertEl.classList.add('d-none');
  }

  function setLoading(btn, loading) {
    const spinner = btn.querySelector('.loading-spinner');
    btn.disabled = loading;
    if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
  }

  // -------------------------------------------------------
  // PASO 1: Solicitar enlace de recuperación
  // -------------------------------------------------------
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('forgotUser').value.trim();
      hideAlert(forgotAlert);
      resetLinkSection.classList.add('d-none');
      setLoading(forgotBtn, true);

      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (!data.success) {
          showAlert(forgotAlert, 'danger', data.message || 'Error al generar el enlace.');
          setLoading(forgotBtn, false);
          return;
        }

        // Mostrar el enlace generado
        resetLinkAnchor.textContent = data.resetLink;
        resetLinkAnchor.href = data.resetLink;
        resetLinkSection.classList.remove('d-none');
        showAlert(forgotAlert, 'success', data.message);

      } catch (error) {
        console.error('Error en forgot-password:', error);
        showAlert(forgotAlert, 'danger', 'Error de conexión con el servidor.');
      }

      setLoading(forgotBtn, false);
    });
  }

  // -------------------------------------------------------
  // PASO 2: Enviar nueva contraseña
  // -------------------------------------------------------
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newPassword     = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      hideAlert(resetAlert);

      // Validar que ambas contraseñas coincidan en el cliente
      if (newPassword !== confirmPassword) {
        showAlert(resetAlert, 'danger', 'Las contraseñas no coinciden.');
        return;
      }

      setLoading(resetBtn, true);

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenFromUrl, newPassword })
        });

        const data = await response.json();

        if (!data.success) {
          showAlert(resetAlert, 'danger', data.message || 'No se pudo cambiar la contraseña.');
          setLoading(resetBtn, false);
          return;
        }

        // Éxito: mostrar mensaje y redirigir al login después de 2 segundos
        showAlert(resetAlert, 'success', data.message);
        resetForm.reset();
        resetBtn.disabled = true;

        setTimeout(() => {
          window.location.href = '/login';
        }, 2500);

      } catch (error) {
        console.error('Error en reset-password:', error);
        showAlert(resetAlert, 'danger', 'Error de conexión con el servidor.');
        setLoading(resetBtn, false);
      }
    });
  }
});
