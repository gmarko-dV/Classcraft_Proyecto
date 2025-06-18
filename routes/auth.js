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
      // Insertar el profesor con la asignatura
      const queryTeacher = 'INSERT INTO profesores (id_usuario, asignatura) VALUES (?, ?)';
      db.query(queryTeacher, [userId, subject], (err, result) => {
        if (err) {
          console.error('Error al insertar profesor: ', err);
          return res.status(500).send('Error al registrar profesor');
        }
        res.redirect('/login');  // Redirigir al login después de registrar al profesor
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
        // Verificar si el alumno ha seleccionado un personaje
        const queryStudent = 'SELECT * FROM estudiantes WHERE id_usuario = ?';
        db.query(queryStudent, [user.id], (err, studentData) => {
          if (err) {
            console.error('Error al obtener datos del alumno: ', err);
            return res.status(500).send('Error al obtener datos del alumno');
          }

          const student = studentData[0];
          if (!student.personaje) {
            // Si no tiene personaje asignado, redirigir al formulario de selección de personaje
            return res.redirect('/choose-character');
          }

          // Si tiene personaje asignado, redirigir al dashboard
          res.redirect('/dashboard');
        });
      } else {
        // Redirigir al dashboard del profesor
        res.redirect('/dashboard');
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

// Ruta GET para mostrar la página de elección de personaje
router.get('/choose-character', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'alumno') {
    return res.redirect('/login');  // Si no está logueado o no es alumno, redirigir al login
  }
  res.render('choose-character');  // Renderiza la página de selección de personaje
});

// Ruta POST para guardar el personaje elegido
router.post('/select-character', (req, res) => {
  const selectedCharacter = req.body.character;
  const userId = req.session.user.id;  // ID del usuario (alumno)

  if (!selectedCharacter) {
    return res.status(400).send('No se ha seleccionado un personaje');
  }

  // Actualizar el personaje en la tabla 'estudiantes'
  const query = 'UPDATE estudiantes SET personaje = ? WHERE id_usuario = ?';
  db.query(query, [selectedCharacter, userId], (err, result) => {
    if (err) {
      console.error('Error al guardar personaje: ', err);
      return res.status(500).send('Error al guardar personaje');
    }

    // Actualizar el personaje en la sesión
    req.session.user.character = selectedCharacter;

    // Redirigir al dashboard después de guardar el personaje
    res.redirect('/dashboard');
  });
});

module.exports = router;
