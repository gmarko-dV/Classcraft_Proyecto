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

// Ruta para registrar a un usuario (con rol, nombre, apellido y contraseña)
router.post('/register', (req, res) => {
  const { first_name, last_name, email, password, confirm_password, role } = req.body;

  // Verificar que las contraseñas coinciden
  if (password !== confirm_password) {
    return res.status(400).send('Las contraseñas no coinciden');
  }

  const query = 'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [first_name, last_name, email, password, role], (err, result) => {
    if (err) {
      console.error('Error en registro: ', err);
      return res.status(500).send('Error en el registro');
    }
    res.redirect('/login');
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
        role: user.role,
        character: user.character
      };

      // Si no tiene personaje, redirige a selección
      if (!user.character) {
        return res.redirect('/choose-character');
      }

      return res.redirect('/dashboard');
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

// Guardar personaje elegido
router.post('/select-character', (req, res) => {
  const selectedCharacter = req.body.character;
  const userId = req.session.user.id;

  const query = 'UPDATE users SET `character` = ? WHERE id = ?';
  db.query(query, [selectedCharacter, userId], (err, result) => {
    if (err) {
      console.error('Error al guardar personaje: ', err);
      return res.status(500).send('Error al guardar personaje');
    }

    // Actualiza sesión y redirige al dashboard
    req.session.user.character = selectedCharacter;
    res.redirect('/dashboard');
  });
});

// Ruta para logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error al cerrar sesión');
    }
    res.redirect('/');
  });
});

module.exports = router;
