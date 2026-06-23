document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authUserInp = document.getElementById('authUser');
    const authPasswordInp = document.getElementById('authPassword');
    const authAlert = document.getElementById('authAlert');
    const submitBtn = document.getElementById('submitBtn');
    const toggleAuthMode = document.getElementById('toggleAuthMode');

    // Por defecto el modo inicial es "login"
    let currentMode = 'login'; 

    // Alternar entre modo Login y Registro dinámicamente
    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Limpiar alertas previas
        authAlert.classList.add('d-none');

        if (currentMode === 'login') {
            currentMode = 'register';
            authTitle.textContent = 'Registrar Cuenta';
            submitBtn.textContent = 'Registrarse';
            toggleAuthMode.textContent = '¿Ya tienes cuenta? Inicia sesión aquí';
        } else {
            currentMode = 'login';
            authTitle.textContent = 'Iniciar Sesión';
            submitBtn.textContent = 'Ingresar';
            toggleAuthMode.textContent = '¿No tienes cuenta? Regístrate aquí';
        }
    });

    // Escuchar el envío del formulario (Tradicional)
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = authUserInp.value.trim();
        const password = authPasswordInp.value;

        // Ocultar alerta y deshabilitar botón durante la carga
        authAlert.classList.add('d-none');
        submitBtn.disabled = true;

        // Determinar a qué endpoint de tu API apuntar
        const url = currentMode === 'login' ? '/api/auth/login' : '/api/auth/register';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!data.success) {
                // Mostrar error devuelto por el Backend
                authAlert.className = 'alert alert-danger';
                authAlert.textContent = data.message || 'Ocurrió un error inesperado.';
                authAlert.classList.remove('d-none');
                submitBtn.disabled = false;
                return;
            }

            if (currentMode === 'register') {
                // Si se registró con éxito, le avisamos y lo cambiamos automáticamente a modo login
                authAlert.className = 'alert alert-success';
                authAlert.textContent = '¡Registro exitoso! Ya puedes iniciar sesión.';
                authAlert.classList.remove('d-none');
                authForm.reset();
                toggleAuthMode.click(); // Forzar el cambio visual a login
                submitBtn.disabled = false;
            } else {
                // Si el login tradicional fue exitoso, guardamos el JWT y redirigimos
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.user.username);
    
                // REDIRECCIÓN CORREGIDA: Ir a la raíz del servidor
                window.location.href = '/';
            }

        } catch (error) {
            console.error('Error en la autenticación:', error);
            authAlert.className = 'alert alert-danger';
            authAlert.textContent = 'Error de conexión con el servidor.';
            authAlert.classList.remove('d-none');
            submitBtn.disabled = false;
        }
    });
});