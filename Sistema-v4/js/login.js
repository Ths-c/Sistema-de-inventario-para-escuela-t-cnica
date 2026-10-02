const form = document.getElementById('form-login');
const error = document.getElementById('error');
const campoUsuario = document.getElementById('usuario');
const campoClave = document.getElementById('password');
const modoInfo = document.createElement('p');
modoInfo.id = 'modo-info';
modoInfo.style.marginTop = '8px';
modoInfo.style.fontSize = '0.85rem';
modoInfo.style.color = '#666';
form.appendChild(modoInfo);

function actualizarModoInfo() {
  const u = campoUsuario.value.trim().toLowerCase();
  if (u === 'admin') {
    modoInfo.textContent = 'Modo: Directivo (todo: herramientas + periféricos)';
  } else if (u === 'admin2') {
    modoInfo.textContent = 'Modo: Computadoras (Mouse, Mouse Pad, Teclado)';
  } else if (u === 'admin1') {
    modoInfo.textContent = 'Modo: Herramientas (Martillos, Guantes, Mechas, etc.)';
  } else {
    modoInfo.textContent = 'Modo: Herramientas (por defecto)';
  }
}

campoUsuario.addEventListener('input', actualizarModoInfo);
campoUsuario.addEventListener('blur', actualizarModoInfo);

// Si ya hay sesión, va directo al inicio
Datos.sesion().then(() => { location.href = 'html/inicio.html'; }).catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = form.querySelector('button');
  error.textContent = '';
  boton.disabled = true;
  try {
    await Datos.login(campoUsuario.value.trim(), campoClave.value);
    location.href = 'html/inicio.html';
  } catch (err) {
    error.textContent = err.message;
    campoClave.value = '';
    campoClave.focus();
    boton.disabled = false;
  }
});
