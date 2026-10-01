/* Datos — capa de acceso a la API del Sistema de Inventario (modo 'api').
   El backend sirve API + frontend en el mismo origen (localhost:3000 en dev,
   https://tu-app.onrender.com en prod). Se usan rutas relativas siempre.
   Para dev con frontend separado (ej. python -m http.server 8000) se puede
   forzar con ?api=http://localhost:3000 o localStorage.API_BASE. */
(function () {
  'use strict';

  const API_BASE = (() => {
    try {
      const q = new URLSearchParams(window.location.search).get('api');
      if (q) { try { localStorage.setItem('API_BASE', q); } catch (_) {}
        return q.replace(/\/$/, ''); }
      const saved = localStorage.getItem('API_BASE');
      // Usar override guardado solo en desarrollo local
      if (saved && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) return saved.replace(/\/$/, '');
    } catch (_) { /* noop */ }
    return '';
  })();

  function guardarSesion(s) {
    try {
      if (s) sessionStorage.setItem('sesion', JSON.stringify(s));
      else sessionStorage.removeItem('sesion');
    } catch (_) { /* storage no disponible */ }
  }

  async function req(path, opciones) {
    const opts = Object.assign({ credentials: 'include' }, opciones || {});
    let res;
    try {
      res = await fetch(API_BASE + path, opts);
    } catch (e) {
      const err = new Error(
        "No se pudo conectar con la API en " + (API_BASE || 'mismo origen') +
        ". Asegurate de que el backend esté corriendo con `node index.js`."
      );
      err.status = 0;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || ('Error HTTP ' + res.status));
      err.status = res.status;
      if (res.status === 401) guardarSesion(null);
      throw err;
    }
    return data;
  }

  const get = (path) => req(path);
  const post = (path, body) =>
    req(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  const put = (path, body) =>
    req(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });

  // Desenvuelve { ok:true, ... } y variantes que devuelva el backend
  function listaTickets(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.tickets)) return data.tickets;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.rows)) return data.rows;
    return [];
  }

  window.Datos = {
    API_BASE,

    async login(usuario, password) {
      if (!usuario || !password) throw new Error('Usuario y contraseña requeridos');
      const data = await post('/api/auth/login', { usuario, password });
      const sesion = {
        usuario: data.usuario || usuario,
        modo: data.modo || 'herramientas',
        rol: data.rol || '',
      };
      guardarSesion(sesion);
      return sesion;
    },

    async sesion() {
      const data = await get('/api/auth/me');
      const sesion = {
        usuario: data.usuario,
        modo: data.modo || 'herramientas',
        rol: data.rol || '',
      };
      guardarSesion(sesion);
      return sesion;
    },

    async logout() {
      try { await post('/api/auth/logout', {}); }
      finally { guardarSesion(null); }
    },

    async catalogos() {
      const data = await get('/api/catalogos');
      return {
        profesores: data.profesores || [],
        preceptores: data.preceptores || [],
        cursos: data.cursos || [],
        herramientas: data.herramientas || [],
      };
    },

    async tickets(filtros) {
      const f = filtros || {};
      const q = new URLSearchParams();
      for (const k of ['fecha', 'curso', 'preceptor', 'profesor', 'limit']) {
        if (f[k] !== undefined && f[k] !== null && String(f[k]).trim() !== '') {
          q.set(k, String(f[k]).trim());
        }
      }
      const qs = q.toString();
      const data = await get('/api/tickets' + (qs ? '?' + qs : ''));
      return listaTickets(data);
    },

    async crearTicket(payload) {
      const data = await post('/api/tickets', payload);
      return { id: data.id };
    },

    async editarTicket(id, payload) {
      await put('/api/tickets/' + encodeURIComponent(id), payload);
      return {};
    },

    async finalizarTicket(id) {
      await post('/api/tickets/' + encodeURIComponent(id) + '/finalizar', {});
      return {};
    },

    // cambios: [{ id, stock }] (stock absoluto)
    async guardarInventario(cambios) {
      const data = await put('/api/herramientas/stock', { items: cambios });
      return data || {};
    },

    async crearHerramienta(nombre, variante, cantidad, modelo, especificacion, categoria) {
      const data = await post('/api/herramientas', {
        nombre, variante, cantidad, modelo, especificacion, categoria,
      });
      // El backend devuelve { ok:true, herramienta:{...} } o la herramienta directa
      return data.herramienta || data;
    },
  };
})();
