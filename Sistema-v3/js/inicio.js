/* Inicio: últimos tickets, con opción de editar sus datos o finalizarlos */
const sel = $('#reciente');
const formEntrada = $('#form-entrada');
let cat = null;
let tickets = [];
let editando = false;

const actual = () => tickets.find((t) => t.id === Number(sel.value));

function formatoItem(item) {
  let txt = item.etiqueta;
  if (item.modelo) txt += ` (${item.modelo})`;
  if (item.especificacion) txt += ` - ${item.especificacion}`;
  return txt;
}

function pintarBotones() {
  const t = actual();
  $('#campos').disabled = !editando;
  $('#btn-editar').hidden = editando || !t;
  $('#btn-guardar').hidden = !editando;
  $('#btn-cancelar').hidden = !editando;
  $('#btn-finalizar').hidden = editando || !t || t.estado !== 'EN_CURSO';
}

function mostrar() {
  editando = false;
  const t = actual();
  for (const k of ['profesor', 'curso', 'preceptor', 'fecha', 'hora']) $('#' + k).value = t ? t[k] : '';
  $('#descripcion').value = t ? t.observaciones : '';
  $('#items').value = t ? t.items.map((i) => `${formatoItem(i)} x${i.cantidad}`).join(', ') : '';
  const e = $('#estado');
  e.hidden = !t;
  if (t) {
    const en = t.estado === 'EN_CURSO';
    e.textContent = en ? 'EN CURSO' : 'FINALIZADO';
    e.className = `estado ${en ? 'en-curso' : 'finalizado'}`;
  }
  pintarBotones();
}

async function cargar(idSeleccion) {
  tickets = await Datos.tickets({ limit: 8 });
  sel.innerHTML = tickets.length
    ? tickets.map((t) => `<option value="${t.id}">#${t.id} - ${esc(t.profesor)} - ${esc(t.curso)}</option>`).join('')
    : '<option value="">Todavía no hay tickets</option>';
  if (idSeleccion && tickets.some((t) => t.id === idSeleccion)) sel.value = idSeleccion;
  mostrar();
}

sel.addEventListener('change', mostrar);
$('#btn-editar').addEventListener('click', () => { editando = true; pintarBotones(); $('#profesor').focus(); });
$('#btn-cancelar').addEventListener('click', mostrar);

formEntrada.addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = actual();
  if (!editando || !t) return;
  const profesor = buscarNombre(cat.profesores, $('#profesor').value);
  const curso = buscarNombre(cat.cursos, $('#curso').value);
  const preceptor = buscarNombre(cat.preceptores, $('#preceptor').value);
  if (!profesor) return toast('Elegí un profesor de la lista.', 'error');
  if (!curso) return toast('Elegí un curso de la lista.', 'error');
  if (!preceptor) return toast('Elegí un preceptor de la lista.', 'error');
  if (!$('#fecha').value || !$('#hora').value) return toast('Completá la fecha y la hora.', 'error');

  const boton = $('#btn-guardar');
  boton.disabled = true;
  try {
    await Datos.editarTicket(t.id, {
      profesor, curso, preceptor,
      fecha: $('#fecha').value, hora: $('#hora').value,
      observaciones: $('#descripcion').value.trim(),
    });
    toast(`Ticket #${t.id} actualizado.`);
    await cargar(t.id);
  } catch (err) { mostrarError(err); }
  finally { boton.disabled = false; }
});

$('#btn-finalizar').addEventListener('click', async () => {
  const t = actual();
  if (!t || !confirm(`¿Finalizar el ticket #${t.id}? Los items vuelven al stock.`)) return;
  try {
    await Datos.finalizarTicket(t.id);
    toast(`Ticket #${t.id} finalizado.`);
    await cargar(t.id);
  } catch (err) { mostrarError(err); }
});

(async () => {
  try {
    cat = await Datos.catalogos();
    crearCombo('profesor', cat.profesores);
    crearCombo('curso', cat.cursos);
    crearCombo('preceptor', cat.preceptores);
    await cargar();
  } catch (err) { mostrarError(err); }
})();
