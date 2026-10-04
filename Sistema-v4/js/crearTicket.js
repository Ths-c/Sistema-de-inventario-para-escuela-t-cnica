/* Crear ticket: un ticket puede llevar varios items */
const form = $('#form-ticket');
let cat = null;
let items = []; // [{ id, etiqueta, cantidad, modelo, especificacion }]

// Texto único de cada item en la lista: incluye el sector (Taller/Escuela) porque
// puede haber items con el mismo nombre en ambos sectores (ej: Netbook).
const textoItem = (h) => `${h.etiqueta}${h.variante ? ` ${h.variante}` : ''} [${nombreSector(h.categoria)}]`;
const itemElegido = () => cat.herramientas.find((h) => textoItem(h).toLowerCase() === $('#item').value.trim().toLowerCase());
const yaAgregado = (id) => (items.find((i) => i.id === id) || { cantidad: 0 }).cantidad;

function formatoItem(item) {
  let txt = esc(item.etiqueta);
  if (item.modelo) txt += ` (${esc(item.modelo)})`;
  if (item.especificacion) txt += ` - ${esc(item.especificacion)}`;
  if (item.categoria) txt += ` · ${esc(nombreSector(item.categoria))}`;
  return txt;
}

function pintarItems() {
  $('#lista-items').innerHTML = items.map((i, n) =>
    `<span class="chip">${formatoItem(i)} x${i.cantidad}<button type="button" data-n="${n}" aria-label="Quitar ${esc(i.etiqueta)}">×</button></span>`).join('');
}

function pintarDisponible() {
  const h = itemElegido();
  $('#disponible').textContent = h ? `Disponible: ${h.stock - yaAgregado(h.id)}` : '';
}

async function cargarCatalogos() {
  cat = await Datos.catalogos();
  crearCombo('profesor', opcionesProfesor(cat.profesores));
  crearCombo('curso', cat.cursos);
  crearCombo('preceptor', cat.preceptores);
  crearCombo('item', cat.herramientas.map((h) => ({ value: textoItem(h), label: `${h.modelo ? `${h.modelo} - ` : ''}${h.especificacion || ''} Stock: ${h.stock}`.trim() })));
}

function fechaHoraActual() { $('#fecha').value = hoyISO(); $('#hora').value = ahoraHM(); }

$('#item').addEventListener('input', pintarDisponible);

// "Otro profesor": mostrar el campo para escribir el nombre del profesor temporal
function actualizarOtroProfesor() {
  const otro = $('#profesor').value.trim().toLowerCase() === PROF_OTRO.toLowerCase();
  $('#bloque-otro').hidden = !otro;
  if (!otro) $('#profesor-otro').value = '';
}
$('#profesor').addEventListener('input', actualizarOtroProfesor);
$('#profesor').addEventListener('change', () => {
  actualizarOtroProfesor();
  if (!$('#bloque-otro').hidden) $('#profesor-otro').focus();
});

$('#btn-agregar').addEventListener('click', () => {
  const h = itemElegido();
  const cant = parseInt($('#cantidad').value, 10);
  if (!h) return toast('Elegí un item de la lista.', 'error');
  if (!(cant >= 1)) return toast('Ingresá una cantidad de 1 o más.', 'error');
  const total = yaAgregado(h.id) + cant;
  if (total > h.stock) return toast(`Solo hay ${h.stock} de ${h.etiqueta} en stock.`, 'error');
  const existente = items.find((i) => i.id === h.id);
  if (existente) existente.cantidad = total; else items.push({ id: h.id, etiqueta: h.etiqueta, cantidad: cant, modelo: h.modelo, especificacion: h.especificacion, categoria: h.categoria });
  $('#item').value = ''; $('#cantidad').value = '';
  pintarItems(); pintarDisponible();
  $('#item').focus();
});

$('#lista-items').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-n]');
  if (!b) return;
  items.splice(Number(b.dataset.n), 1);
  pintarItems(); pintarDisponible();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let profesor = buscarNombre(opcionesProfesor(cat.profesores), $('#profesor').value);
  if (profesor === PROF_OTRO) {
    const nombre = $('#profesor-otro').value.trim().replace(/\s+/g, ' ');
    if (!nombre) return toast('Escribí el nombre del profesor temporal.', 'error');
    profesor = nombre + SUFIJO_OTRO;
  }
  const curso = buscarNombre(cat.cursos, $('#curso').value);
  const preceptor = buscarNombre(cat.preceptores, $('#preceptor').value);
  if (!profesor) return toast('Elegí un profesor de la lista.', 'error');
  if (!curso) return toast('Elegí un curso de la lista.', 'error');
  if (!preceptor) return toast('Elegí un preceptor de la lista.', 'error');
  if (!items.length) return toast('Agregá al menos un item con el botón AGREGAR.', 'error');
  if (!$('#fecha').value || !$('#hora').value) return toast('Completá la fecha y la hora.', 'error');

  const boton = form.querySelector('[type=submit]');
  boton.disabled = true;
  try {
    const r = await Datos.crearTicket({
      profesor, curso, preceptor,
      fecha: $('#fecha').value, hora: $('#hora').value,
      observaciones: $('#descripcion').value.trim(),
      items: items.map(({ id, cantidad }) => ({ id, cantidad })),
    });
    toast(`Ticket #${r.id} creado.`);
    form.reset(); items = []; actualizarOtroProfesor(); pintarItems(); fechaHoraActual();
    await cargarCatalogos(); pintarDisponible();
  } catch (err) { mostrarError(err); }
  finally { boton.disabled = false; }
});

(async () => {
  try { await cargarCatalogos(); fechaHoraActual(); } catch (err) { mostrarError(err); }
})();
