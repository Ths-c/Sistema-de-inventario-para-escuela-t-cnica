-- Sistema de Inventario — script de base de datos (MySQL / MariaDB).
-- Uso:  mysql -u root < DBINVENTARIO.sql
-- Crea la base `inventario` con el esquema que usa el backend (index.js).
-- NOTA: el backend funciona igual sin MySQL (modo memoria); este script es
-- opcional, para persistencia real.

CREATE DATABASE IF NOT EXISTS inventario
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventario;

CREATE TABLE IF NOT EXISTS usuarios (
  usuario  VARCHAR(80)  PRIMARY KEY,
  password VARCHAR(200) NOT NULL,
  modo     VARCHAR(30)  NOT NULL DEFAULT 'herramientas',
  rol      VARCHAR(40)  NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS herramientas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  etiqueta      VARCHAR(120) NOT NULL,
  variante      VARCHAR(80)  NOT NULL DEFAULT '',
  modelo        VARCHAR(120) NOT NULL DEFAULT '',
  especificacion VARCHAR(250) NOT NULL DEFAULT '',
  stock         INT NOT NULL DEFAULT 0,
  categoria     VARCHAR(30)  NOT NULL DEFAULT 'herramientas',
  UNIQUE KEY uq_herramienta (etiqueta, variante)
);

CREATE TABLE IF NOT EXISTS tickets (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  profesor      VARCHAR(120) NOT NULL,
  curso         VARCHAR(80)  NOT NULL,
  preceptor     VARCHAR(120) NOT NULL,
  fecha         DATE NOT NULL,
  hora          VARCHAR(8) NOT NULL,
  observaciones VARCHAR(500) NOT NULL DEFAULT '',
  estado        VARCHAR(20) NOT NULL DEFAULT 'EN_CURSO'
);

CREATE TABLE IF NOT EXISTS ticket_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id       INT NOT NULL,
  herramienta_id  INT NOT NULL,
  etiqueta        VARCHAR(120) NOT NULL DEFAULT '',
  modelo          VARCHAR(120) NOT NULL DEFAULT '',
  especificacion  VARCHAR(250) NOT NULL DEFAULT '',
  cantidad        INT NOT NULL DEFAULT 1,
  FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
);

-- Usuarios de acceso (ver LEEME.md)
INSERT IGNORE INTO usuarios (usuario, password, modo, rol) VALUES
  ('admin',  'admin123', 'directivo',    'directivo'),
  ('admin1', '1234',     'herramientas', 'preceptor_taller'),
  ('admin2', '1234',     'perifericos',  'preceptor_escuela');

-- Stock inicial
INSERT IGNORE INTO herramientas (etiqueta, variante, modelo, especificacion, stock, categoria) VALUES
  ('Martillo',      '',            '', '', 12, 'herramientas'),
  ('Guantes',       'Trabajo',     '', '', 30, 'herramientas'),
  ('Mecha',         '6mm',         '', '', 25, 'herramientas'),
  ('Destornillador','Phillips',    '', '', 15, 'herramientas'),
  ('Pinza',         '',            '', '', 10, 'herramientas'),
  ('Mouse',         'Inalámbrico', '', '', 20, 'perifericos'),
  ('Mouse Pad',     '',            '', '', 20, 'perifericos'),
  ('Teclado',       'USB',         '', '', 15, 'perifericos'),
  ('PC',            '', 'Dell OptiPlex 7090', 'i5-11400, 8GB RAM, 256GB SSD', 8,  'perifericos'),
  ('Netbook',       '', 'Exo Smart E19',      'Celeron, 4GB RAM, 240GB SSD',  10, 'perifericos');
