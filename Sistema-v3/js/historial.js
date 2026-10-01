/* Historial: tarjetas de tickets con filtros y detalle */
const filtro = $('#form-filtro');
const grilla = $('#resultados');
const dialogo = $('#detalle');
let lista = [];
let abierto = null;

const claseEstado = (t) => (t.estado === 'EN_CURSO' ? 'en-curso' : 'finalizado');
const textoEstado = (t) => (t.estado === 'EN_CURSO' ? 'EN CURSO' : 'FINALIZADO');
const campo = (rotulo, valor) => `<div class="campo"><label>${rotulo}</label><div class="valor">${esc(valor) || '&nbsp;'}</div></div>`;

function formatoItem(item) {
  let txt = esc(item.etiqueta);
  if (item.modelo) txt += ` (${esc(item.modelo)})`;
  if (item.especificacion) txt += ` - ${esc(item.especificacion)}`;
  return txt;
}

function pintar() {
  $('#cuenta').textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'ticket' : 'tickets'}` : '';
  if (!lista.length) {
    grilla.innerHTML = '<div class="vacio">No hay tickets con esos filtros. Probá con otra fecha o limpiá el filtro.</div>';
    return;
  }
  grilla.innerHTML = lista.map((t) => `
    <article class="ticket">
      <div class="conter-tickets">
        <div class="card-top">
          <span class="num">Ticket #${t.id} - ${fechaCorta(t.fecha)} ${esc(t.hora)}</span>
          <span class="estado ${claseEstado(t)}">${textoEstado(t)}</span>
        </div>
        <div class="info">
          ${campo('PROFESOR', t.profesor)}
          ${campo('CURSO', t.curso)}
          ${campo('PRECEPTOR', t.preceptor)}
        </div>
        <div class="card-bottom">
          ${campo('DESCRIPCION', t.observaciones)}
          <div class="elemento"><span>TOTAL DE ELEMENTOS</span><strong>${t.total}</strong></div>
        </div>
      </div>
      <button type="button" class="btn-ver-mas" data-id="${t.id}">VER MAS <span aria-hidden="true">↗</span></button>
    </article>`).join('');
}

async function buscar() {
  const f = {};
  for (const k of ['fecha', 'curso', 'preceptor', 'profesor']) { const v = filtro.elements[k].value.trim(); if (v) f[k] = v; }
  try { lista = await Datos.tickets(f); pintar(); } catch (err) { mostrarError(err); }
}

function abrirDetalle(id) {
  abierto = lista.find((t) => t.id === id);
  if (!abierto) return;
  const t = abierto;
  $('#detalle-cuerpo').innerHTML = `
    <h2>Ticket #${t.id} <span class="estado ${claseEstado(t)}">${textoEstado(t)}</span></h2>
    ${campo('PROFESOR', t.profesor)}${campo('CURSO', t.curso)}${campo('PRECEPTOR', t.preceptor)}
    ${campo('FECHA Y HORA', `${fechaCorta(t.fecha)} - ${t.hora}`)}
    <div class="campo"><label>ELEMENTOS (${t.total})</label>
      <div class="lista-items">${t.items.map((i) => `<div><span>${formatoItem(i)}</span><strong>x${i.cantidad}</strong></div>`).join('')}</div></div>
    ${campo('OBSERVACIONES', t.observaciones)}`;
  $('#dlg-finalizar').hidden = t.estado !== 'EN_CURSO';
  dialogo.showModal();
}

grilla.addEventListener('click', (e) => {
  const b = e.target.closest('.btn-ver-mas');
  if (b) abrirDetalle(Number(b.dataset.id));
});
$('#dlg-cerrar').addEventListener('click', () => dialogo.close());
dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); }); // clic afuera cierra

$('#dlg-finalizar').addEventListener('click', async () => {
  if (!abierto || !confirm(`¿Finalizar el ticket #${abierto.id}? Los items vuelven al stock.`)) return;
  try {
    await Datos.finalizarTicket(abierto.id);
    toast(`Ticket #${abierto.id} finalizado.`);
    dialogo.close();
    await buscar();
  } catch (err) { mostrarError(err); }
});

filtro.addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
$('#btn-limpiar').addEventListener('click', () => { filtro.reset(); buscar(); });

(async () => {
  try {
    const cat = await Datos.catalogos();
    crearCombo('profesor', cat.profesores);
    crearCombo('curso', cat.cursos);
    crearCombo('preceptor', cat.preceptores);
    await buscar();
  } catch (err) { mostrarError(err); }
})();
