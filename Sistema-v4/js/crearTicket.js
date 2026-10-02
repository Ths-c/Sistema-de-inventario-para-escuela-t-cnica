/* Crear ticket: un ticket puede llevar varios items */
const form = $('#form-ticket');
let cat = null;
let items = []; // [{ id, etiqueta, cantidad, modelo, especificacion }]

const itemElegido = () => cat.herramientas.find((h) => h.etiqueta.toLowerCase() === $('#item').value.trim().toLowerCase());
const yaAgregado = (id) => (items.find((i) => i.id === id) || { cantidad: 0 }).cantidad;

function formatoItem(item) {
  let txt = esc(item.etiqueta);
  if (item.modelo) txt += ` (${esc(item.modelo)})`;
  if (item.especificacion) txt += ` - ${esc(item.especificacion)}`;
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
  crearCombo('profesor', cat.profesores);
  crearCombo('curso', cat.cursos);
  crearCombo('preceptor', cat.preceptores);
  crearCombo('item', cat.herramientas.map((h) => ({ value: h.etiqueta, label: `${h.modelo ? `${h.modelo} - ` : ''}${h.especificacion || ''} Stock: ${h.stock}`.trim() })));
}

function fechaHoraActual() { $('#fecha').value = hoyISO(); $('#hora').value = ahoraHM(); }

$('#item').addEventListener('input', pintarDisponible);

$('#btn-agregar').addEventListener('click', () => {
  const h = itemElegido();
  const cant = parseInt($('#cantidad').value, 10);
  if (!h) return toast('Elegí un item de la lista.', 'error');
  if (!(cant >= 1)) return toast('Ingresá una cantidad de 1 o más.', 'error');
  const total = yaAgregado(h.id) + cant;
  if (total > h.stock) return toast(`Solo hay ${h.stock} de ${h.etiqueta} en stock.`, 'error');
  const existente = items.find((i) => i.id === h.id);
  if (existente) existente.cantidad = total; else items.push({ id: h.id, etiqueta: h.etiqueta, cantidad: cant, modelo: h.modelo, especificacion: h.especificacion });
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
  const profesor = buscarNombre(cat.profesores, $('#profesor').value);
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
    form.reset(); items = []; pintarItems(); fechaHoraActual();
    await cargarCatalogos(); pintarDisponible();
  } catch (err) { mostrarError(err); }
  finally { boton.disabled = false; }
});

(async () => {
  try { await cargarCatalogos(); fechaHoraActual(); } catch (err) { mostrarError(err); }
})();
