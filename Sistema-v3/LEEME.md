# Sistema de Inventario

Sistema de préstamos de herramientas y periféricos (tickets) para la escuela.
Frontend: HTML + CSS + JS vanilla. Backend: Node.js + Express (`index.js`, API en puerto 3000).
Base de datos: MySQL/MariaDB **opcional** (sin ella el backend usa memoria).

## Cómo correrlo (completo)

Desde esta carpeta (`Sistema-v3/`):

```bash
npm install        # solo la primera vez
node index.js
```

Abrir en el navegador: **http://localhost:3000**

Ese único comando levanta API + frontend juntos. No hace falta `python -m http.server`
(aunque sigue funcionando: servir esta carpeta en el puerto 8000 y entrar a
http://localhost:8000, con el backend corriendo en el 3000).

## Usuarios de prueba

| Usuario  | Contraseña | Ve |
|----------|------------|----|
| `admin`  | `admin123` | Todo (directivo: herramientas + periféricos, puede agregar items de ambas categorías) |
| `admin1` | `1234`     | Herramientas de taller (martillos, guantes, mechas, etc.) |
| `admin2` | `1234`     | Periféricos/computación (mouse, teclado, PC, netbook) |

## Base de datos (opcional)

Sin MySQL el sistema anda igual, pero los datos se pierden al apagar el servidor.
Para persistencia real:

1. Iniciar MariaDB/MySQL.
2. Importar el esquema y datos iniciales:
   ```bash
   mysql -u root < DBINVENTARIO.sql
   ```
   (Crea la base `inventario` con tablas `usuarios`, `herramientas`, `tickets`, `ticket_items`.)
3. El backend detecta solo la base `inventario` en `localhost` con usuario `root` sin
   contraseña. Para otros valores usar variables de entorno:
   ```bash
    DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=secreto DB_NAME=inventario node index.js
    ```
4. Verificar: http://localhost:3000/api/health muestra `"db":"mysql"` si conectó
   o `"db":"memoria"` si está en modo sin base.

> El archivo viejo `DBINVENTARIO2` quedó como referencia histórica (tenía errores de
> sintaxis y un esquema incompatible). El válido es `DBINVENTARIO.sql`.
