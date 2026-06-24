document.addEventListener('DOMContentLoaded', () => {
    // ========== DOM REFS ==========
    const loginCard = document.getElementById('loginCard');
    const forgotCard = document.getElementById('forgotCard');
    const resetCard = document.getElementById('resetCard');

    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authUserInp = document.getElementById('authUser');
    const authEmailInp = document.getElementById('authEmail');
    const authPasswordInp = document.getElementById('authPassword');
    const authConfirmPasswordInp = document.getElementById('authConfirmPassword');
    const authAlert = document.getElementById('authAlert');
    const submitBtn = document.getElementById('submitBtn');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    const emailGroup = document.getElementById('emailGroup');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');

    const forgotForm = document.getElementById('forgotForm');
    const forgotEmail = document.getElementById('forgotEmail');
    const forgotAlert = document.getElementById('forgotAlert');
    const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
    const tokenDisplay = document.getElementById('tokenDisplay');
    const tokenText = document.getElementById('tokenText');
    const backToLoginFromForgot = document.getElementById('backToLoginFromForgot');

    const resetForm = document.getElementById('resetForm');
    const resetToken = document.getElementById('resetToken');
    const resetNewPassword = document.getElementById('resetNewPassword');
    const resetConfirmPassword = document.getElementById('resetConfirmPassword');
    const resetAlert = document.getElementById('resetAlert');
    const resetSubmitBtn = document.getElementById('resetSubmitBtn');
    const backToLoginFromReset = document.getElementById('backToLoginFromReset');

    let currentMode = 'login';

    function showAlert(el, message, type) {
        el.className = `alert alert-${type}`;
        el.textContent = message;
        el.classList.remove('d-none');
    }

    function hideAlert(el) {
        el.classList.add('d-none');
    }

    function toggleForm() {
        hideAlert(authAlert);
        hideAlert(forgotAlert);
        hideAlert(resetAlert);

        if (currentMode === 'login') {
            currentMode = 'register';
            authTitle.textContent = 'Registrar Cuenta';
            submitBtn.textContent = 'Registrarse';
            toggleAuthMode.textContent = '¿Ya tienes cuenta? Inicia sesión aquí';
            emailGroup.classList.remove('d-none');
            authEmailInp.required = true;
            confirmPasswordGroup.classList.remove('d-none');
            authConfirmPasswordInp.required = true;
        } else {
            currentMode = 'login';
            authTitle.textContent = 'Iniciar Sesión';
            submitBtn.textContent = 'Ingresar';
            toggleAuthMode.textContent = '¿No tienes cuenta? Regístrate aquí';
            emailGroup.classList.add('d-none');
            authEmailInp.required = false;
            confirmPasswordGroup.classList.add('d-none');
            authConfirmPasswordInp.required = false;
        }
    }

    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForm();
    });

    // ========== MAIN AUTH FORM (Login / Register) ==========
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(authAlert);
        submitBtn.disabled = true;

        const username = authUserInp.value.trim();
        const password = authPasswordInp.value;

        if (currentMode === 'register') {
            const email = authEmailInp.value.trim();
            const confirmPassword = authConfirmPasswordInp.value;

            if (!email) {
                showAlert(authAlert, 'El correo electrónico es requerido.', 'danger');
                submitBtn.disabled = false;
                return;
            }
            if (password !== confirmPassword) {
                showAlert(authAlert, 'Las contraseñas no coinciden.', 'danger');
                submitBtn.disabled = false;
                return;
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await response.json();
                if (!data.success) {
                    showAlert(authAlert, data.message || 'Error en el registro.', 'danger');
                    submitBtn.disabled = false;
                    return;
                }
                showAlert(authAlert, '¡Registro exitoso! Ya puedes iniciar sesión.', 'success');
                authForm.reset();
                toggleForm();
                submitBtn.disabled = false;
            } catch (err) {
                showAlert(authAlert, 'Error de conexión con el servidor.', 'danger');
                submitBtn.disabled = false;
            }
            return;
        }

        // LOGIN
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!data.success) {
                showAlert(authAlert, data.message || 'Credenciales inválidas.', 'danger');
                submitBtn.disabled = false;
                return;
            }
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            if (data.user.username === 'admin') {
              window.location.href = '/admin?token=' + encodeURIComponent(data.token);
            } else {
              window.location.href = '/';
            }
        } catch (err) {
            showAlert(authAlert, 'Error de conexión con el servidor.', 'danger');
            submitBtn.disabled = false;
        }
    });

    // ========== FORGOT PASSWORD ==========
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.classList.add('d-none');
        forgotCard.classList.remove('d-none');
        hideAlert(forgotAlert);
        tokenDisplay.classList.add('d-none');
    });

    backToLoginFromForgot.addEventListener('click', (e) => {
        e.preventDefault();
        forgotCard.classList.add('d-none');
        loginCard.classList.remove('d-none');
        hideAlert(forgotAlert);
    });

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(forgotAlert);
        forgotSubmitBtn.disabled = true;

        const email = forgotEmail.value.trim();
        if (!email) {
            showAlert(forgotAlert, 'Ingresa tu correo electrónico.', 'danger');
            forgotSubmitBtn.disabled = false;
            return;
        }

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (!data.success) {
                showAlert(forgotAlert, data.message || 'Error al generar token.', 'danger');
                forgotSubmitBtn.disabled = false;
                return;
            }
            tokenText.value = data.resetToken;
            tokenDisplay.classList.remove('d-none');
            forgotSubmitBtn.textContent = 'Token Generado';
            showAlert(forgotAlert, 'Token generado con éxito. Cópialo y ve a restablecer tu contraseña.', 'success');
            forgotSubmitBtn.disabled = false;
        } catch (err) {
            showAlert(forgotAlert, 'Error de conexión con el servidor.', 'danger');
            forgotSubmitBtn.disabled = false;
        }
    });

    // ========== RESET PASSWORD ==========
    tokenDisplay.addEventListener('dblclick', () => {
        forgotCard.classList.add('d-none');
        resetCard.classList.remove('d-none');
        hideAlert(resetAlert);
        resetToken.value = tokenText.value;
    });

    function goToReset() {
        forgotCard.classList.add('d-none');
        resetCard.classList.remove('d-none');
        hideAlert(resetAlert);
    }

    const goToResetLink = document.createElement('a');
    goToResetLink.href = '#';
    goToResetLink.className = 'text-decoration-none d-block text-center mt-2';
    goToResetLink.textContent = 'Ya tengo el token, restablecer contraseña';
    goToResetLink.addEventListener('click', (e) => {
        e.preventDefault();
        goToReset();
    });
    tokenDisplay.appendChild(goToResetLink);

    backToLoginFromReset.addEventListener('click', (e) => {
        e.preventDefault();
        resetCard.classList.add('d-none');
        loginCard.classList.remove('d-none');
        hideAlert(resetAlert);
    });

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(resetAlert);
        resetSubmitBtn.disabled = true;

        const token = resetToken.value.trim();
        const newPassword = resetNewPassword.value;
        const confirmPassword = resetConfirmPassword.value;

        if (!token) {
            showAlert(resetAlert, 'El token es requerido.', 'danger');
            resetSubmitBtn.disabled = false;
            return;
        }
        if (!newPassword) {
            showAlert(resetAlert, 'La nueva contraseña es requerida.', 'danger');
            resetSubmitBtn.disabled = false;
            return;
        }
        if (newPassword !== confirmPassword) {
            showAlert(resetAlert, 'Las contraseñas no coinciden.', 'danger');
            resetSubmitBtn.disabled = false;
            return;
        }

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });
            const data = await response.json();
            if (!data.success) {
                showAlert(resetAlert, data.message || 'Error al restablecer.', 'danger');
                resetSubmitBtn.disabled = false;
                return;
            }
            showAlert(resetAlert, 'Contraseña actualizada exitosamente. Redirigiendo...', 'success');
            setTimeout(() => {
                resetCard.classList.add('d-none');
                loginCard.classList.remove('d-none');
                resetForm.reset();
            }, 2000);
            resetSubmitBtn.disabled = false;
        } catch (err) {
            showAlert(resetAlert, 'Error de conexión con el servidor.', 'danger');
            resetSubmitBtn.disabled = false;
        }
    });
});
