const express = require('express');
const router = express.Router();
const db = require('../config/db');
const path = require('path');

// Página de login
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'login.html'));
});

// Página de registro
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'register.html'));
});

// Ruta para registrar a un usuario (con rol profesor o alumno)
router.post('/register', (req, res) => {
  const { first_name, last_name, email, password, confirm_password, role, subject, class_id, section_id } = req.body;

  // Verificar que las contraseñas coincidan
  if (password !== confirm_password) {
    return res.status(400).send('Las contraseñas no coinciden');
  }

  // Insertar en la tabla usuarios
  const queryUser = 'INSERT INTO usuarios (nombre, apellido, correo_electronico, contrasena, rol) VALUES (?, ?, ?, ?, ?)';
  db.query(queryUser, [first_name, last_name, email, password, role], (err, result) => {
    if (err) {
      console.error('Error en registro de usuario: ', err);
      return res.status(500).send('Error en el registro');
    }

    const userId = result.insertId; // Obtener el ID del usuario recién insertado

    if (role === 'alumno') {
      // Insertar en la tabla estudiantes con el ID correcto
      const queryStudent = 'INSERT INTO estudiantes (id_usuario) VALUES (?)';
      db.query(queryStudent, [userId], (err, result) => {
        if (err) {
          console.error('Error al insertar alumno: ', err);
          return res.status(500).send('Error al registrar alumno');
        }
        // Redirigir al estudiante a la página de selección de personaje
        res.redirect('/choose-character');  // Redirige a la página de selección de personaje
      });
    } else if (role === 'profesor') {
      // Verificar si la asignatura existe en la base de datos
      const queryCheckSubject = 'SELECT id FROM clases WHERE nombre = ?';
      db.query(queryCheckSubject, [subject], (err, result) => {
        if (err) {
          console.error('Error al verificar asignatura: ', err);
          return res.status(500).send('Error al verificar asignatura');
        }

        let subjectId;

        if (result.length > 0) {
          subjectId = result[0].id;
        } else {
          // Insertar nueva asignatura si no existe
          const queryInsertSubject = 'INSERT INTO clases (nombre) VALUES (?)';
          db.query(queryInsertSubject, [subject], (err, result) => {
            if (err) {
              console.error('Error al insertar asignatura: ', err);
              return res.status(500).send('Error al insertar asignatura');
            }
            subjectId = result.insertId;
          });
        }

        const queryTeacher = 'INSERT INTO profesores (id_usuario, id_asignatura) VALUES (?, ?)';
        db.query(queryTeacher, [userId, subjectId], (err, result) => {
          if (err) {
            console.error('Error al insertar profesor: ', err);
            return res.status(500).send('Error al registrar profesor');
          }
          res.redirect('/login');
        });
      });
    }
  });
});

// Ruta para login (autenticación)
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM usuarios WHERE correo_electronico = ? AND contrasena = ?';
  db.query(query, [email, password], (err, result) => {
    if (err) {
      console.error('Error en login: ', err);
      return res.status(500).send('Error en el login');
    }

    if (result.length > 0) {
      const user = result[0];
      req.session.user = {
        id: user.id,
        first_name: user.nombre,
        last_name: user.apellido,
        email: user.correo_electronico,
        role: user.rol
      };

      if (user.rol === 'alumno') {
        const queryStudent = 'SELECT * FROM estudiantes WHERE id_usuario = ?';
        db.query(queryStudent, [user.id], (err, result) => {
          if (err) {
            console.error('Error al obtener datos del alumno: ', err);
            return res.status(500).send('Error al obtener datos del alumno');
          }
          if (result.length > 0) {
            req.session.user.gold = result[0].oro;
            req.session.user.character = result[0].personaje;
          }
          res.redirect('/dashboard');
        });
      } else if (user.rol === 'profesor') {
        const queryTeacher = 'SELECT * FROM profesores WHERE id_usuario = ?';
        db.query(queryTeacher, [user.id], (err, result) => {
          if (err) {
            console.error('Error al obtener datos del profesor: ', err);
            return res.status(500).send('Error al obtener datos del profesor');
          }
          if (result.length > 0) {
            req.session.user.character = result[0].personaje;  // Personaje del profesor
          }
          res.redirect('/dashboard');
        });
      }
    } else {
      res.status(400).send('Credenciales incorrectas');
    }
  });
});

// Ruta para cerrar sesión
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al destruir la sesión: ', err);
      return res.status(500).send('Error al cerrar sesión');
    }
    res.redirect('/login');  // Redirige al login después de cerrar sesión
  });
});

// Ruta para mostrar la página de selección de personaje
router.get('/choose-character', (req, res) => {
  if (!req.session.user) return res.redirect('/login');  // Si no está logueado, redirigir al login
  res.render('choose-character');  // Renderiza la página de selección de personaje
});

// Ruta para guardar el personaje elegido
router.post('/select-character', (req, res) => {
  const { character } = req.body;
  const userId = req.session.user.id;  // Asumimos que el ID del estudiante está almacenado en la sesión

  // Verificar que se haya seleccionado un personaje
  if (!character) {
    return res.status(400).send('No se ha seleccionado un personaje');
  }

  // Actualizar el personaje en la tabla 'estudiantes'
  const queryUpdateCharacter = 'UPDATE estudiantes SET personaje = ? WHERE id_usuario = ?';
  db.query(queryUpdateCharacter, [character, userId], (err, result) => {
    if (err) {
      console.error('Error al guardar personaje: ', err);
      return res.status(500).send('Error al guardar personaje');
    }

    // Si se actualizó correctamente, actualizamos la sesión con el personaje elegido
    req.session.user.character = character;

    // Redirigir al dashboard después de guardar el personaje
    res.redirect('/dashboard');
  });
});

module.exports = router;
