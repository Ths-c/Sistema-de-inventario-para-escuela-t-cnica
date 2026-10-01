/* Inventario: una fila por item con su stock actual; solo se guardan las que cambian.
   Además, un diálogo aparte para agregar un item nuevo a la lista. */
const formInv = $('#form-inventario');
const dialogoNueva = $('#dlg-nueva');
const formNueva = $('#form-nueva');
const camposPc = $('#campos-pc');
const inputNombre = $('#nombre-nuevo');
const selectCategoria = $('#categoria-nueva');
let items = [];

function sesionActual() {
  try {
    const s = sessionStorage.getItem('sesion');
    return s ? JSON.parse(s) : {};
  } catch (_) { return {}; }
}

function esDirectivo() {
  const s = sesionActual();
  return s.modo === 'directivo' || s.modo === 'ambos' || s.rol === 'directivo';
}

// Categoría por defecto según el modo del usuario (admin2 -> perifericos)
function categoriaPorDefecto() {
  const s = sesionActual();
  return s.modo === 'perifericos' ? 'perifericos' : 'herramientas';
}

function esPcONotebook(nombre) {
  const n = (nombre || '').toLowerCase();
  return n === 'pc' || n === 'netbook' || n.includes('pc') || n.includes('netbook');
}

function toggleCamposPc() {
  camposPc.hidden = !esPcONotebook(inputNombre.value);
}

async function cargar() {
  items = (await Datos.catalogos()).herramientas;
  $('#lista').innerHTML = items.map((h) => `
    <div class="fila" data-id="${h.id}">
      <label for="h${h.id}">${esc(h.etiqueta).toUpperCase()}${h.modelo ? ` (${esc(h.modelo)})` : ''}${h.especificacion ? ` - ${esc(h.especificacion)}` : ''}:</label>
      <input type="number" id="h${h.id}" data-id="${h.id}" min="0" step="1" value="${h.stock}">
    </div>`).join('');
}

$('#lista').addEventListener('input', (e) => {
  const inp = e.target.closest('input');
  if (!inp) return;
  const h = items.find((x) => x.id === Number(inp.dataset.id));
  inp.closest('.fila').classList.toggle('cambiado', Number(inp.value) !== h.stock);
});

formInv.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cambios = [];
  for (const inp of formInv.querySelectorAll('input[data-id]')) {
    const id = Number(inp.dataset.id);
    const stock = Number(inp.value);
    const h = items.find((x) => x.id === id);
    if (inp.value === '' || !Number.isInteger(stock) || stock < 0) return toast(`Revisá la cantidad de ${h.etiqueta}: tiene que ser un número entero desde 0.`, 'error');
    if (stock !== h.stock) cambios.push({ id, stock });
  }
  if (!cambios.length) return toast('No hay cambios para guardar.', 'error');

  const boton = formInv.querySelector('[type=submit]');
  boton.disabled = true;
  try {
    await Datos.guardarInventario(cambios);
    toast(cambios.length === 1 ? 'Se actualizó 1 item.' : `Se actualizaron ${cambios.length} items.`);
    await cargar();
  } catch (err) { mostrarError(err); }
  finally { boton.disabled = false; }
});

// ---- Agregar item ----
$('#btn-agregar').addEventListener('click', () => {
  formNueva.reset();
  toggleCamposPc();
  const directo = esDirectivo();
  selectCategoria.parentElement.hidden = !directo;
  if (directo) selectCategoria.value = 'herramientas';
  else selectCategoria.value = categoriaPorDefecto();
  dialogoNueva.showModal();
});
$('#dlg-cancelar').addEventListener('click', () => dialogoNueva.close());
dialogoNueva.addEventListener('click', (e) => { if (e.target === dialogoNueva) dialogoNueva.close(); });

inputNombre.addEventListener('input', toggleCamposPc);

formNueva.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = $('#nombre-nuevo').value.trim();
  const cantidad = parseInt($('#cantidad-nueva').value, 10);
  if (!nombre) return toast('Escribí el nombre del item.', 'error');
  if (!(cantidad >= 1)) return toast('Ingresá una cantidad de 1 o más.', 'error');

  const boton = formNueva.querySelector('[type=submit]');
  boton.disabled = true;
  try {
    const r = await Datos.crearHerramienta(
      nombre,
      $('#variante-nueva').value.trim(),
      cantidad,
      $('#modelo-nuevo').value.trim(),
      $('#especificacion-nueva').value.trim(),
      esDirectivo() ? selectCategoria.value : categoriaPorDefecto()
    );
    toast(`Se agregó ${r.etiqueta} con ${r.stock} unidades.`);
    dialogoNueva.close();
    await cargar();
  } catch (err) { mostrarError(err); }
  finally { boton.disabled = false; }
});

cargar().catch(mostrarError);
