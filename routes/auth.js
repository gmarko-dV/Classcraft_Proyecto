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
      // Guardamos la información del usuario en la sesión
      req.session.user = {
        id: result[0].id,
        first_name: result[0].first_name,
        last_name: result[0].last_name,
        email: result[0].email,
        role: result[0].role
      };
      res.redirect('/dashboard');
    } else {
      res.status(400).send('Credenciales incorrectas');
    }
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
