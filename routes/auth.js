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

// Ruta para registrar a un usuario
router.post('/register', (req, res) => {
  const { first_name, last_name, email, password, role } = req.body;

  // Insertar en la tabla users
  const queryUser = 'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)';
  db.query(queryUser, [first_name, last_name, email, password, role], (err, result) => {
    if (err) {
      console.error('Error en registro de usuario: ', err);
      return res.status(500).send('Error en el registro');
    }

    const userId = result.insertId;

    if (role === 'alumno') {
      // Insertar en la tabla students
      const queryStudent = 'INSERT INTO students (user_id) VALUES (?)';
      db.query(queryStudent, [userId], (err, result) => {
        if (err) {
          console.error('Error al insertar alumno: ', err);
          return res.status(500).send('Error al registrar alumno');
        }
        res.redirect('/login');
      });
    } else if (role === 'profesor') {
      // Insertar en la tabla teachers
      const queryTeacher = 'INSERT INTO teachers (user_id, subject) VALUES (?, ?)';
      db.query(queryTeacher, [userId, req.body.subject], (err, result) => {
        if (err) {
          console.error('Error al insertar profesor: ', err);
          return res.status(500).send('Error al registrar profesor');
        }
        res.redirect('/login');
      });
    }
  });
});

// Ruta para login (autenticación)
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, result) => {
    if (err) {
      console.error('Error en login: ', err);
      return res.status(500).send('Error en el login');
    }

    if (result.length > 0) {
      const user = result[0];
      req.session.user = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role
      };

      // Si es alumno, obtener los datos del personaje
      if (user.role === 'alumno') {
        const queryStudent = 'SELECT * FROM students WHERE user_id = ?';
        db.query(queryStudent, [user.id], (err, result) => {
          if (err) {
            console.error('Error al obtener datos del alumno: ', err);
            return res.status(500).send('Error al obtener datos del alumno');
          }
          if (result.length > 0) {
            req.session.user.gold = result[0].gold;
            req.session.user.character = result[0].character;
          }
          
          // Si no tiene personaje, redirige a la página de selección de personaje
          if (!req.session.user.character) {
            return res.redirect('/choose-character');
          }

          res.redirect('/dashboard');  // Redirige al dashboard si tiene personaje
        });
      } else {
        res.redirect('/dashboard');
      }
    } else {
      res.status(400).send('Credenciales incorrectas');
    }
  });
});

// Vista para elegir personaje
router.get('/choose-character', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('choose-character');
});

// Ruta para guardar el personaje elegido
router.post('/select-character', (req, res) => {
  const selectedCharacter = req.body.character;
  const userId = req.session.user.id;  // ID del usuario (que es el alumno)

  if (!selectedCharacter) {
    return res.status(400).send('No se ha seleccionado un personaje');
  }

  // Actualizamos el personaje en la tabla 'students' (no en 'users')
  const query = 'UPDATE students SET `character` = ? WHERE user_id = ?';
  db.query(query, [selectedCharacter, userId], (err, result) => {
    if (err) {
      console.error('Error al guardar personaje: ', err);
      return res.status(500).send('Error al guardar personaje');
    }

    // Si se actualizó correctamente, actualizamos la sesión con el personaje elegido
    req.session.user.character = selectedCharacter;

    // Redirigir al dashboard después de guardar el personaje
    res.redirect('/dashboard');
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

module.exports = router;
