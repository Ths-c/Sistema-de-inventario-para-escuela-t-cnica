/* Utilidades y estructura compartida (header, footer, avisos) */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ahoraHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fechaCorta = (iso) => iso.split('-').reverse().join('/');

function toast(mensaje, tipo = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = mensaje;
  t.className = `show ${tipo}`;
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.className = ''; }, 3800);
}

function mostrarError(e) {
  if (e && e.status === 401) { location.href = '../index.html'; return; }
  toast((e && e.message) || 'Ocurrió un error. Probá de nuevo.', 'error');
}

function llenarDatalist(id, items) {
  const dl = document.getElementById(id);
  if (dl) {
    dl.innerHTML = items.map((i) => (typeof i === 'string'
      ? `<option value="${esc(i)}">`
      : `<option value="${esc(i.value)}" label="${esc(i.label)}">`)).join('');
  }
  // Compat: si existe un combo con input que usaba ese datalist, actualizarlo también.
  // Mapeo datalist -> input: profesores/cursos/preceptores/items.
  const mapa = { profesores: 'profesor', cursos: 'curso', preceptores: 'preceptor', items: 'item' };
  const inputId = mapa[id];
  if (inputId && document.getElementById(inputId)) setComboOpciones(inputId, items);
}

/* ---------- Combobox con buscador: abre al tocar (click/focus/▼), filtra al escribir ----------
   Uso: crearCombo('profesor', ['Ana', 'Luis']) o crearCombo('item', [{value, label}]).
   Requiere en el HTML:
     <div class="combo">
       <input id="..." ... autocomplete="off">
       <button type="button" class="combo-toggle" aria-label="Mostrar opciones">▼</button>
       <ul class="combo-lista" hidden></ul>
     </div> */
const __combos = {};

function __normalizarOpciones(items) {
  return (items || []).map((i) => (typeof i === 'string'
    ? { value: i, label: '' }
    : { value: String(i.value ?? ''), label: String(i.label ?? '') }));
}

function __pintarCombo(input) {
  const id = input.id;
  const estado = __combos[id];
  if (!estado) return;
  const filtro = input.value.trim().toLowerCase();
  const lista = estado.ul;
  const visibles = estado.opciones.filter((o) =>
    !filtro || o.value.toLowerCase().includes(filtro) || o.label.toLowerCase().includes(filtro));
  estado.visibles = visibles;
  estado.resaltado = -1;
  if (!visibles.length) {
    lista.innerHTML = '<li class="combo-vacio" aria-disabled="true">Sin resultados</li>';
    return;
  }
  lista.innerHTML = visibles.map((o, n) =>
    `<li role="option" data-n="${n}"><span>${esc(o.value)}</span>${o.label ? `<small>${esc(o.label)}</small>` : ''}</li>`).join('');
}

function __abrirCombo(input) {
  const estado = __combos[input.id];
  if (!estado) return;
  // Cerrar los demás
  for (const k of Object.keys(__combos)) {
    if (k !== input.id) __cerrarCombo(document.getElementById(k));
  }
  __pintarCombo(input);
  estado.ul.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function __cerrarCombo(input) {
  if (!input) return;
  const estado = __combos[input.id];
  if (!estado) return;
  estado.ul.hidden = true;
  input.setAttribute('aria-expanded', 'false');
}

function __elegirCombo(input, n) {
  const estado = __combos[input.id];
  if (!estado || !estado.visibles[n]) return;
  input.value = estado.visibles[n].value;
  __cerrarCombo(input);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function crearCombo(inputId, items) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const combo = input.closest('.combo');
  const ul = combo ? combo.querySelector('.combo-lista') : null;
  const btn = combo ? combo.querySelector('.combo-toggle') : null;
  if (!ul) return;
  if (!__combos[inputId]) {
    __combos[inputId] = { opciones: [], visibles: [], resaltado: -1, ul };
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    // Abrir al enfocar o tocar el campo (aunque esté vacío: muestra todo)
    input.addEventListener('focus', () => __abrirCombo(input));
    input.addEventListener('click', () => { if (ul.hidden) __abrirCombo(input); });
    // Filtrar al escribir
    input.addEventListener('input', () => __abrirCombo(input));
    // Teclado: navegar y elegir
    input.addEventListener('keydown', (e) => {
      const estado = __combos[inputId];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (ul.hidden) { __abrirCombo(input); return; }
        const d = e.key === 'ArrowDown' ? 1 : -1;
        estado.resaltado = (estado.resaltado + d + estado.visibles.length) % Math.max(estado.visibles.length, 1);
        ul.querySelectorAll('li[data-n]').forEach((li) =>
          li.classList.toggle('resaltado', Number(li.dataset.n) === estado.resaltado));
        const sel = ul.querySelector('li.resaltado');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        const estado2 = __combos[inputId];
        if (!ul.hidden && estado2.resaltado >= 0) { e.preventDefault(); __elegirCombo(input, estado2.resaltado); }
      } else if (e.key === 'Escape') {
        __cerrarCombo(input);
      }
    });
    // Elegir con mouse o dedo
    ul.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('li[data-n]');
      if (li) { e.preventDefault(); __elegirCombo(input, Number(li.dataset.n)); }
    });
    // Botón ▼: abre/cierra siempre
    if (btn) btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (ul.hidden) { input.focus(); __abrirCombo(input); }
      else __cerrarCombo(input);
    });
    // Cerrar al salir del combo
    input.addEventListener('blur', () => setTimeout(() => {
      if (!combo.contains(document.activeElement)) __cerrarCombo(input);
    }, 120));
  }
  setComboOpciones(inputId, items);
}

function setComboOpciones(inputId, items) {
  const estado = __combos[inputId];
  if (!estado) return;
  estado.opciones = __normalizarOpciones(items);
  const input = document.getElementById(inputId);
  if (input && !estado.ul.hidden) __pintarCombo(input);
}

// Clic fuera de cualquier combo: cerrar todos
document.addEventListener('pointerdown', (e) => {
  for (const k of Object.keys(__combos)) {
    const input = document.getElementById(k);
    const combo = input ? input.closest('.combo') : null;
    if (combo && !combo.contains(e.target)) __cerrarCombo(input);
  }
});

// Devuelve el nombre exacto de la lista aunque el usuario escriba distinto en mayúsculas
const buscarNombre = (lista, valor) => lista.find((x) => x.toLowerCase() === String(valor || '').trim().toLowerCase()) || null;

const NAV = [
  ['inicio.html', 'INICIO', 'inicio'],
  ['Historial.html', 'HISTORIAL', 'historial'],
  ['crearTicket.html', 'CREAR TICKET', 'crear'],
  ['inventario.html', 'INVENTARIO', 'inventario'],
];

function montarLayout() {
  const activa = document.body.dataset.pagina;
  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <a class="logo" href="inicio.html" aria-label="Ir al inicio"><img src="../img/tecnica.jpg" alt="Logo de la escuela"></a>
    <nav aria-label="Principal">${NAV.map(([href, txt, clave]) =>
      `<a href="${href}"${clave === activa ? ' class="activo" aria-current="page"' : ''}>${txt}</a>`).join('')}</nav>
    <button type="button" class="btn-salir" id="btn-salir">SALIR</button>`;
  const footer = document.createElement('footer');
  footer.innerHTML = '<h3>2026 TODOS LOS DERECHOS RESERVADOS - MONTE HERMOSO / BUENOS AIRES / ARGENTINA</h3>';
  document.body.prepend(header);
  document.body.append(footer);
  $('#btn-salir').addEventListener('click', async () => {
    try { await Datos.logout(); } finally { location.href = '../index.html'; }
  });
}

montarLayout();
Datos.sesion().catch(() => { location.href = '../index.html'; });
