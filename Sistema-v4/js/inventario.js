/* Inventario: una fila por item con su stock actual; solo se guardan las que cambian.
   Además, un diálogo aparte para agregar un item nuevo a la lista. */
const formInv = $('#form-inventario');
const dialogoNueva = $('#dlg-nueva');
const formNueva = $('#form-nueva');
const camposPc = $('#campos-pc');
const inputNombre = $('#nombre-nuevo');
const selectCategoria = $('#categoria-nueva');
let items = [];

// sesionActual() y esDirectivo() vienen de common.js

function configurarVista() {
  const rol = sesionActual().rol;
  const directo = rol === 'directivo';
  const titulo = $('#titulo-inventario');
  const subtitulo = $('#subtitulo-inventario');

  titulo.firstChild.textContent = rol === 'directivo'
    ? 'EDITAR HERRAMIENTAS, PERIFERICOS Y STOCK'
    : rol === 'preceptor_taller' ? 'STOCK HERRAMIENTAS'
      : rol === 'preceptor_escuela' ? 'STOCK DE PERIFERICOS' : 'STOCK';
  subtitulo.hidden = !directo;
  formInv.querySelector('[type=submit]').hidden = !directo;
  $('#btn-agregar').hidden = !directo;
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
  const soloLectura = !esDirectivo();
  const directo = !soloLectura;
  const fila = (h) => `
    <div class="fila" data-id="${h.id}">
      <label for="h${h.id}">${esc(h.etiqueta).toUpperCase()}${h.modelo ? ` (${esc(h.modelo)})` : ''}${h.especificacion ? ` - ${esc(h.especificacion)}` : ''}:</label>
      <div class="fila-controles">
        <input type="number" id="h${h.id}" data-id="${h.id}" min="0" step="1" value="${h.stock}"${soloLectura ? ' readonly' : ''}>
        ${directo ? `<select data-sector-id="${h.id}" aria-label="Sector de ${esc(h.etiqueta)}">
          <option value="herramientas"${h.categoria !== 'perifericos' ? ' selected' : ''}>Taller</option>
          <option value="perifericos"${h.categoria === 'perifericos' ? ' selected' : ''}>Escuela</option>
        </select>` : ''}
      </div>
    </div>`;
  // Agrupado por sector: Taller y Escuela (cada preceptor solo recibe los de su sector)
  const grupos = [['herramientas', 'TALLER'], ['perifericos', 'ESCUELA']]
    .map(([cat, titulo]) => [titulo, items.filter((h) => (h.categoria === 'perifericos' ? 'perifericos' : 'herramientas') === cat)])
    .filter(([, lista]) => lista.length);
  $('#lista').innerHTML = grupos.map(([titulo, lista]) =>
    `${directo ? `<h2 class="sector-titulo">${titulo}</h2>` : ''}${lista.map(fila).join('')}`).join('');
}

$('#lista').addEventListener('input', (e) => {
  const campo = e.target.closest('input, select');
  if (!campo) return;
  const id = Number(campo.dataset.id || campo.dataset.sectorId);
  const h = items.find((x) => x.id === id);
  const fila = campo.closest('.fila');
  const inp = fila.querySelector('input');
  const sel = fila.querySelector('select');
  const sectorCambio = sel && sel.value !== (h.categoria === 'perifericos' ? 'perifericos' : 'herramientas');
  fila.classList.toggle('cambiado', Number(inp.value) !== h.stock || !!sectorCambio);
});

formInv.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cambios = [];
  for (const inp of formInv.querySelectorAll('input[data-id]')) {
    const id = Number(inp.dataset.id);
    const stock = Number(inp.value);
    const h = items.find((x) => x.id === id);
    if (inp.value === '' || !Number.isInteger(stock) || stock < 0) return toast(`Revisá la cantidad de ${h.etiqueta}: tiene que ser un número entero desde 0.`, 'error');
    const sel = formInv.querySelector(`select[data-sector-id="${id}"]`);
    const catActual = h.categoria === 'perifericos' ? 'perifericos' : 'herramientas';
    const sectorCambio = sel && sel.value !== catActual;
    if (stock !== h.stock || sectorCambio) cambios.push(sectorCambio ? { id, stock, categoria: sel.value } : { id, stock });
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

configurarVista();
cargar().catch(mostrarError);
