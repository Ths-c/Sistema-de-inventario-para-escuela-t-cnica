/* Sistema de Inventario — API backend (Express).
   - Sirve el frontend estático de esta misma carpeta (http://localhost:3000).
   - Persiste en MySQL/MariaDB si está disponible (base `inventario`);
     si no, usa almacenamiento en memoria (igual funcionalidad mientras corre).
   - Sesiones con express-session (cookie). */
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Necesario detrás de proxies (Render/Railway) para cookies secure + IP real
app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
if (!process.env.SESSION_SECRET && isProd) {
  console.warn('AVISO: SESSION_SECRET no definido. Definilo en las variables de entorno.');
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'inventario-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd, // en https (prod) la cookie viaja solo por https
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

/* ================= Datos semilla (compartidos memoria + MySQL) ================= */
const SEED = {
  usuarios: [
    { usuario: 'admin', password: 'admin123', modo: 'directivo', rol: 'directivo' },
    { usuario: 'admin1', password: '1234', modo: 'herramientas', rol: 'preceptor_taller' },
    { usuario: 'admin2', password: '1234', modo: 'perifericos', rol: 'preceptor_escuela' },
  ],
  profesores: ['García Juan', 'López María', 'Fernández Carlos', 'Sosa Ana'],
  preceptores: ['Pérez Ana', 'Gómez Luis', 'Torres Marta'],
  cursos: ['1° A', '2° B', '3° A', '4° Taller'],
  herramientas: [
    { etiqueta: 'Martillo', variante: '', modelo: '', especificacion: '', stock: 12, categoria: 'herramientas' },
    { etiqueta: 'Guantes', variante: 'Trabajo', modelo: '', especificacion: '', stock: 30, categoria: 'herramientas' },
    { etiqueta: 'Mecha', variante: '6mm', modelo: '', especificacion: '', stock: 25, categoria: 'herramientas' },
    { etiqueta: 'Destornillador', variante: 'Phillips', modelo: '', especificacion: '', stock: 15, categoria: 'herramientas' },
    { etiqueta: 'Pinza', variante: '', modelo: '', especificacion: '', stock: 10, categoria: 'herramientas' },
    { etiqueta: 'Mouse', variante: 'Inalámbrico', modelo: '', especificacion: '', stock: 20, categoria: 'perifericos' },
    { etiqueta: 'Mouse Pad', variante: '', modelo: '', especificacion: '', stock: 20, categoria: 'perifericos' },
    { etiqueta: 'Teclado', variante: 'USB', modelo: '', especificacion: '', stock: 15, categoria: 'perifericos' },
    { etiqueta: 'PC', variante: '', modelo: 'Dell OptiPlex 7090', especificacion: 'i5-11400, 8GB RAM, 256GB SSD', stock: 8, categoria: 'perifericos' },
    { etiqueta: 'Netbook', variante: '', modelo: 'Exo Smart E19', especificacion: 'Celeron, 4GB RAM, 240GB SSD', stock: 10, categoria: 'perifericos' },
  ],
};

/* ================= Almacén en memoria ================= */
const mem = {
  usuarios: SEED.usuarios.map((u) => ({ ...u })),
  profesores: [...SEED.profesores],
  preceptores: [...SEED.preceptores],
  cursos: [...SEED.cursos],
  herramientas: SEED.herramientas.map((h, i) => ({ id: i + 1, ...h })),
  tickets: [],
  nextHerrId: SEED.herramientas.length + 1,
  nextTicketId: 1,
};

/* ================= MySQL opcional ================= */
let pool = null;
let dbOk = false;

async function initDb() {
  try {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventario',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // Clever Cloud / PlanetScale / Aiven exigen SSL. Activar con DB_SSL=true
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    const conn = await pool.getConnection();
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS usuarios (
        usuario VARCHAR(80) PRIMARY KEY,
        password VARCHAR(200) NOT NULL,
        modo VARCHAR(30) NOT NULL DEFAULT 'herramientas',
        rol VARCHAR(40) NOT NULL DEFAULT ''
      )`);
      await conn.query(`CREATE TABLE IF NOT EXISTS herramientas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        etiqueta VARCHAR(120) NOT NULL,
        variante VARCHAR(80) NOT NULL DEFAULT '',
        modelo VARCHAR(120) NOT NULL DEFAULT '',
        especificacion VARCHAR(250) NOT NULL DEFAULT '',
        stock INT NOT NULL DEFAULT 0,
        categoria VARCHAR(30) NOT NULL DEFAULT 'herramientas'
      )`);
      await conn.query(`CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        profesor VARCHAR(120) NOT NULL,
        curso VARCHAR(80) NOT NULL,
        preceptor VARCHAR(120) NOT NULL,
        fecha DATE NOT NULL,
        hora VARCHAR(8) NOT NULL,
        observaciones VARCHAR(500) NOT NULL DEFAULT '',
        estado VARCHAR(20) NOT NULL DEFAULT 'EN_CURSO'
      )`);
      await conn.query(`CREATE TABLE IF NOT EXISTS ticket_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        herramienta_id INT NOT NULL,
        etiqueta VARCHAR(120) NOT NULL DEFAULT '',
        modelo VARCHAR(120) NOT NULL DEFAULT '',
        especificacion VARCHAR(250) NOT NULL DEFAULT '',
        cantidad INT NOT NULL DEFAULT 1,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )`);

      const [uCount] = await conn.query('SELECT COUNT(*) AS n FROM usuarios');
      if (uCount[0].n === 0) {
        for (const u of SEED.usuarios) {
          await conn.query('INSERT INTO usuarios (usuario, password, modo, rol) VALUES (?,?,?,?)',
            [u.usuario, u.password, u.modo, u.rol]);
        }
      }
      const [hCount] = await conn.query('SELECT COUNT(*) AS n FROM herramientas');
      if (hCount[0].n === 0) {
        for (const h of SEED.herramientas) {
          await conn.query(
            'INSERT INTO herramientas (etiqueta, variante, modelo, especificacion, stock, categoria) VALUES (?,?,?,?,?,?)',
            [h.etiqueta, h.variante, h.modelo, h.especificacion, h.stock, h.categoria]);
        }
      }
    } finally {
      conn.release();
    }
    dbOk = true;
    console.log('BD MySQL disponible: persistencia en `inventario`');
  } catch (e) {
    dbOk = false;
    console.log('Sin MySQL (' + (e.code || e.message) + '). Se usa almacenamiento en memoria.');
  }
}

/* ================= Helpers de almacenamiento ================= */
function filtrarPorModo(lista, modo) {
  if (modo === 'herramientas') return lista.filter((h) => h.categoria !== 'perifericos');
  if (modo === 'perifericos') return lista.filter((h) => h.categoria === 'perifericos');
  return lista; // directivo / ambos: todo
}

async function dbHerramientas(modo) {
  if (!dbOk) return filtrarPorModo(mem.herramientas, modo);
  const [rows] = await pool.query('SELECT * FROM herramientas ORDER BY id');
  return filtrarPorModo(rows, modo);
}

async function dbFindHerramienta(id) {
  const nid = Number(id);
  if (!dbOk) return mem.herramientas.find((h) => h.id === nid) || null;
  const [rows] = await pool.query('SELECT * FROM herramientas WHERE id = ?', [nid]);
  return rows[0] || null;
}

async function dbTicketConItems(t) {
  let items = [];
  if (!dbOk) {
    const full = mem.tickets.find((x) => x.id === t.id);
    items = full ? full.items : [];
  } else {
    const [rows] = await pool.query(
      'SELECT herramienta_id AS id, etiqueta, modelo, especificacion, cantidad FROM ticket_items WHERE ticket_id = ?',
      [t.id]);
    items = rows;
  }
  const total = items.reduce((a, i) => a + Number(i.cantidad || 0), 0);
  return {
    id: t.id,
    profesor: t.profesor,
    curso: t.curso,
    preceptor: t.preceptor,
    fecha: typeof t.fecha === 'object' && t.fecha !== null && t.fecha.toISOString
      ? t.fecha.toISOString().slice(0, 10)
      : String(t.fecha).slice(0, 10),
    hora: String(t.hora).slice(0, 5),
    observaciones: t.observaciones || '',
    estado: t.estado,
    items,
    total,
  };
}

function ok(data) { return Object.assign({ ok: true }, data); }
function modoSesion(req) { return (req.session && req.session.modo) || 'herramientas'; }
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) return res.status(401).json({ error: 'Sin sesión' });
  next();
}

/* ================= AUTH ================= */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(401).json({ error: 'Usuario y contraseña requeridos' });
    let found = null;
    if (!dbOk) {
      found = mem.usuarios.find((u) => u.usuario === usuario && u.password === password);
    } else {
      const [rows] = await pool.query('SELECT * FROM usuarios WHERE usuario = ? AND password = ?', [usuario, password]);
      found = rows[0] || null;
    }
    if (!found) return res.status(401).json({ error: 'Credenciales inválidas' });
    req.session.usuario = found.usuario;
    req.session.modo = found.modo;
    req.session.rol = found.rol;
    res.json(ok({ usuario: found.usuario, modo: found.modo, rol: found.rol }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.usuario) return res.status(401).json({ error: 'Sin sesión' });
  res.json(ok({ usuario: req.session.usuario, modo: req.session.modo, rol: req.session.rol }));
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json(ok({})));
});

/* ================= CATÁLOGOS ================= */
app.get('/api/catalogos', requireAuth, async (req, res) => {
  try {
    const herramientas = await dbHerramientas(modoSesion(req));
    res.json(ok({
      profesores: mem.profesores,
      preceptores: mem.preceptores,
      cursos: mem.cursos,
      herramientas,
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================= TICKETS ================= */
app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const { fecha, curso, preceptor, profesor, limit } = req.query;
    let base = [];
    if (!dbOk) {
      base = [...mem.tickets].sort((a, b) => b.id - a.id);
    } else {
      let sql = 'SELECT * FROM tickets WHERE 1=1';
      const params = [];
      if (fecha) { sql += ' AND fecha = ?'; params.push(fecha); }
      if (curso) { sql += ' AND curso LIKE ?'; params.push('%' + curso + '%'); }
      if (preceptor) { sql += ' AND preceptor LIKE ?'; params.push('%' + preceptor + '%'); }
      if (profesor) { sql += ' AND profesor LIKE ?'; params.push('%' + profesor + '%'); }
      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(Math.min(parseInt(limit, 10) || 60, 200));
      const [rows] = await pool.query(sql, params);
      base = rows;
    }
    if (!dbOk) {
      if (fecha) base = base.filter((t) => t.fecha === fecha);
      if (curso) base = base.filter((t) => t.curso.toLowerCase().includes(String(curso).toLowerCase()));
      if (preceptor) base = base.filter((t) => t.preceptor.toLowerCase().includes(String(preceptor).toLowerCase()));
      if (profesor) base = base.filter((t) => t.profesor.toLowerCase().includes(String(profesor).toLowerCase()));
      base = base.slice(0, Math.min(parseInt(limit, 10) || 60, 200));
    }
    const out = [];
    for (const t of base) out.push(await dbTicketConItems(t));
    res.json(ok({ tickets: out }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const { profesor, curso, preceptor, fecha, hora, observaciones, items } = req.body || {};
    if (!profesor || !curso || !preceptor) return res.status(400).json({ error: 'Profesor, curso y preceptor son obligatorios' });
    if (!fecha || !hora) return res.status(400).json({ error: 'Fecha y hora son obligatorias' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Agregá al menos un item' });

    // Validar stock
    const det = [];
    for (const it of items) {
      const h = await dbFindHerramienta(it.id);
      if (!h) return res.status(400).json({ error: 'Item #' + it.id + ' no existe' });
      const cant = parseInt(it.cantidad, 10);
      if (!(cant >= 1)) return res.status(400).json({ error: 'Cantidad inválida para ' + h.etiqueta });
      if (cant > h.stock) return res.status(400).json({ error: 'Solo hay ' + h.stock + ' de ' + h.etiqueta + ' en stock' });
      det.push({ h, cant });
    }

    if (!dbOk) {
      const id = mem.nextTicketId++;
      mem.tickets.push({
        id, profesor, curso, preceptor, fecha, hora,
        observaciones: observaciones || '', estado: 'EN_CURSO',
        items: det.map(({ h, cant }) => ({
          id: h.id, etiqueta: h.etiqueta, modelo: h.modelo || '',
          especificacion: h.especificacion || '', cantidad: cant,
        })),
      });
      for (const { h, cant } of det) h.stock -= cant;
      return res.json(ok({ id }));
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(
        'INSERT INTO tickets (profesor, curso, preceptor, fecha, hora, observaciones, estado) VALUES (?,?,?,?,?,?,\'EN_CURSO\')',
        [profesor, curso, preceptor, fecha, hora, observaciones || '']);
      const id = r.insertId;
      for (const { h, cant } of det) {
        await conn.query(
          'INSERT INTO ticket_items (ticket_id, herramienta_id, etiqueta, modelo, especificacion, cantidad) VALUES (?,?,?,?,?,?)',
          [id, h.id, h.etiqueta, h.modelo || '', h.especificacion || '', cant]);
        await conn.query('UPDATE herramientas SET stock = stock - ? WHERE id = ?', [cant, h.id]);
      }
      await conn.commit();
      res.json(ok({ id }));
    } catch (e) {
      try { await conn.rollback(); } catch (_) { /* noop */ }
      throw e;
    } finally { conn.release(); }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const { profesor, curso, preceptor, fecha, hora, observaciones } = req.body || {};
    if (!dbOk) {
      const t = mem.tickets.find((x) => x.id === Number(req.params.id));
      if (!t) return res.status(404).json({ error: 'Ticket no existe' });
      Object.assign(t, { profesor, curso, preceptor, fecha, hora, observaciones: observaciones || '' });
      return res.json(ok({}));
    }
    const [r] = await pool.query(
      'UPDATE tickets SET profesor=?, curso=?, preceptor=?, fecha=?, hora=?, observaciones=? WHERE id=?',
      [profesor, curso, preceptor, fecha, hora, observaciones || '', req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Ticket no existe' });
    res.json(ok({}));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tickets/:id/finalizar', requireAuth, async (req, res) => {
  try {
    if (!dbOk) {
      const t = mem.tickets.find((x) => x.id === Number(req.params.id));
      if (!t) return res.status(404).json({ error: 'Ticket no existe' });
      if (t.estado === 'FINALIZADO') return res.status(409).json({ error: 'Ya finalizado' });
      for (const it of t.items) {
        const h = mem.herramientas.find((x) => x.id === it.id);
        if (h) h.stock += it.cantidad;
      }
      t.estado = 'FINALIZADO';
      return res.json(ok({}));
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM tickets WHERE id=?', [req.params.id]);
      const t = rows[0];
      if (!t) { await conn.rollback(); return res.status(404).json({ error: 'Ticket no existe' }); }
      if (t.estado === 'FINALIZADO') { await conn.rollback(); return res.status(409).json({ error: 'Ya finalizado' }); }
      const [items] = await conn.query('SELECT herramienta_id, cantidad FROM ticket_items WHERE ticket_id=?', [req.params.id]);
      for (const it of items) {
        await conn.query('UPDATE herramientas SET stock = stock + ? WHERE id = ?', [it.cantidad, it.herramienta_id]);
      }
      await conn.query('UPDATE tickets SET estado="FINALIZADO" WHERE id=?', [req.params.id]);
      await conn.commit();
      res.json(ok({}));
    } catch (e) {
      try { await conn.rollback(); } catch (_) { /* noop */ }
      throw e;
    } finally { conn.release(); }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================= HERRAMIENTAS / STOCK ================= */
app.post('/api/herramientas', requireAuth, async (req, res) => {
  try {
    const { nombre, variante, cantidad, modelo, especificacion, categoria } = req.body || {};
    const etiqueta = String(nombre || '').trim();
    if (!etiqueta) return res.status(400).json({ error: 'Escribí el nombre del item' });
    const cant = parseInt(cantidad, 10);
    if (!(cant >= 1)) return res.status(400).json({ error: 'Ingresá una cantidad de 1 o más' });
    const cat = categoria === 'perifericos' ? 'perifericos' : 'herramientas';

    if (!dbOk) {
      const dup = mem.herramientas.find((h) =>
        h.etiqueta.toLowerCase() === etiqueta.toLowerCase() &&
        (h.variante || '').toLowerCase() === String(variante || '').trim().toLowerCase());
      if (dup) return res.status(409).json({ error: 'Ese item ya existe' });
      const h = {
        id: mem.nextHerrId++,
        etiqueta,
        variante: String(variante || '').trim(),
        modelo: String(modelo || '').trim(),
        especificacion: String(especificacion || '').trim(),
        stock: cant,
        categoria: cat,
      };
      mem.herramientas.push(h);
      return res.json(ok({ herramienta: h }));
    }
    const [dup] = await pool.query(
      'SELECT id FROM herramientas WHERE LOWER(etiqueta)=LOWER(?) AND LOWER(variante)=LOWER(?) LIMIT 1',
      [etiqueta, String(variante || '').trim()]);
    if (dup.length) return res.status(409).json({ error: 'Ese item ya existe' });
    const [r] = await pool.query(
      'INSERT INTO herramientas (etiqueta, variante, modelo, especificacion, stock, categoria) VALUES (?,?,?,?,?,?)',
      [etiqueta, String(variante || '').trim(), String(modelo || '').trim(),
        String(especificacion || '').trim(), cant, cat]);
    const [rows] = await pool.query('SELECT * FROM herramientas WHERE id=?', [r.insertId]);
    res.json(ok({ herramienta: rows[0] }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Incremento puntual (compat): { id, cantidad }
app.post('/api/herramientas/stock', requireAuth, async (req, res) => {
  try {
    const { id, cantidad } = req.body || {};
    const h = await dbFindHerramienta(id);
    if (!h) return res.status(404).json({ error: 'Item no existe' });
    const cant = parseInt(cantidad, 10) || 0;
    if (!dbOk) { h.stock += cant; return res.json(ok({ herramienta: h })); }
    await pool.query('UPDATE herramientas SET stock = stock + ? WHERE id = ?', [cant, h.id]);
    const [rows] = await pool.query('SELECT * FROM herramientas WHERE id=?', [h.id]);
    res.json(ok({ herramienta: rows[0] }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardado absoluto desde inventario: { items:[{id, stock}] }
app.put('/api/herramientas/stock', requireAuth, async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Sin cambios' });
    let cambios = 0;
    for (const it of items) {
      const stock = Number(it.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({ error: 'Stock inválido para item #' + it.id });
      }
      if (!dbOk) {
        const h = mem.herramientas.find((x) => x.id === Number(it.id));
        if (!h) return res.status(404).json({ error: 'Item #' + it.id + ' no existe' });
        h.stock = stock;
      } else {
        const [r] = await pool.query('UPDATE herramientas SET stock=? WHERE id=?', [stock, it.id]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Item #' + it.id + ' no existe' });
      }
      cambios++;
    }
    res.json(ok({ cambios }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: dbOk ? 'mysql' : 'memoria', time: new Date().toISOString() });
});

/* ================= Frontend estático ================= */
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

initDb().then(() => {
  app.listen(PORT, () => console.log('Sistema corriendo en http://localhost:' + PORT + ' (API + frontend)'));
});
