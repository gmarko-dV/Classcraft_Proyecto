-- Crear base de datos
CREATE DATABASE IF NOT EXISTS classcraft;
USE classcraft;

-- Crear la tabla de usuarios
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  correo_electronico VARCHAR(100) NOT NULL,
  contrasena VARCHAR(100) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  rol ENUM('alumno', 'profesor') NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de estudiantes
CREATE TABLE estudiantes (
  id_usuario INT PRIMARY KEY,
  personaje VARCHAR(20) DEFAULT NULL,
  oro INT DEFAULT 0,
  hp INT DEFAULT 50,
  xp INT DEFAULT 0,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

-- Crear la tabla de profesores
CREATE TABLE profesores (
  id_usuario INT PRIMARY KEY,
  asignatura VARCHAR(100) NOT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

-- Crear la tabla de artículos de la tienda
CREATE TABLE articulos_tienda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  precio INT NOT NULL,
  descripcion TEXT,
  url_imagen VARCHAR(255)
);

-- Crear la tabla de compras realizadas por los estudiantes
CREATE TABLE compras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT,
  id_articulo INT,
  fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_usuario),
  FOREIGN KEY (id_articulo) REFERENCES articulos_tienda(id)
);

-- Crear la tabla de clases
CREATE TABLE clases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  asignatura VARCHAR(100) NOT NULL,
  id_profesor INT,
  FOREIGN KEY (id_profesor) REFERENCES profesores(id_usuario)
);

-- Crear la tabla de secciones
CREATE TABLE secciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  id_clase INT,
  FOREIGN KEY (id_clase) REFERENCES clases(id)
);

-- Crear la tabla para asignar estudiantes a clases y secciones
CREATE TABLE clase_estudiantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_clase INT,
  id_estudiante INT,
  id_seccion INT,
  FOREIGN KEY (id_clase) REFERENCES clases(id),
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_usuario),
  FOREIGN KEY (id_seccion) REFERENCES secciones(id)
);

-- Desactivar restricciones seguras
SET SQL_SAFE_UPDATES = 0;

-- Insertar un profesor de prueba
INSERT INTO usuarios (correo_electronico, contrasena, nombre, apellido, rol)
VALUES ('profe1@clase.com', '12345', 'Ana', 'García', 'profesor');

-- Insertar el profesor en la tabla profesores con asignatura "Base de Datos Avanzado"
INSERT INTO profesores (id_usuario, asignatura)
VALUES (1, 'Base de Datos Avanzado');

-- Insertar dos clases con la asignatura correspondiente
INSERT INTO clases (nombre, asignatura, id_profesor)
VALUES ('Clase A', 'Base de Datos Avanzado', 1),
       ('Clase B', 'Base de Datos Avanzado', 1);

-- Insertar secciones para esas clases
INSERT INTO secciones (nombre, id_clase)
VALUES ('C24-A', 1),
       ('C24-B', 2);

-- Insertar artículos en la tienda
INSERT INTO articulos_tienda (nombre, precio, descripcion, url_imagen) VALUES
('Gema Mágica', 150, 'Una gema mágica que puede aumentar las habilidades de tu personaje.', 'gema_magica.png'),
('Mascota Dragón', 200, 'Una mascota que te acompaña en tus aventuras.', 'mascota_dragon.png'),
('Espada Épica', 250, 'Una espada legendaria que aumenta el ataque del personaje.', 'espada_epica.png'),
('Escudo Protector', 180, 'Un escudo que otorga defensa extra contra los enemigos.', 'escudo_protector.png'),
('Poción de Salud', 50, 'Una poción que restaura la salud de tu personaje al instante.', 'pocion_salud.png'),
('Máscara Fantasmagórica', 120, 'Una máscara que te otorga invisibilidad temporal.', 'mascara_fantasmagorica.png'),
('Ala de Ángel', 300, 'Un ala que permite a tu personaje volar por un corto tiempo.', 'ala_angel.png'),
('Amuleto de Fuerza', 220, 'Un amuleto que aumenta la fuerza física del personaje.', 'amuletodefuerza.png'),
('Capa de Sigilo', 175, 'Una capa que reduce el ruido al moverse, otorgando sigilo.', 'capa_sigilo.png'),
('Báculo Mágico', 280, 'Un báculo que incrementa las habilidades mágicas del personaje.', 'baculo_magico.png');
