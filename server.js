const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./config/db');  // Asegúrate de tener este archivo de configuración para la base de datos
const app = express();
const port = 3000;

// Configuración para usar body parser (enviar datos en formularios)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 
// Configurar sesión
app.use(session({
  secret: 'mi_clave_secreta',
  resave: false,
  saveUninitialized: true
}));

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rutas
const authRoutes = require('./routes/auth');
app.use(authRoutes);

// Rutas de la página principal
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  }
});

// Ruta para el dashboard
app.get('/dashboard', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'alumno') {
      const userId = req.session.user.id;
      const queryStudent = 'SELECT * FROM students WHERE user_id = ?';
      db.query(queryStudent, [userId], (err, result) => {
        if (err) {
          console.error('Error al obtener datos del alumno: ', err);
          return res.status(500).send('Error al obtener datos del alumno');
        }
        const student = result[0];
        req.session.user.gold = student.gold;
        req.session.user.character = student.character;
        res.render('dashboard', { user: req.session.user });
      });
    } else {
      res.render('dashboard', { user: req.session.user });
    }
  } else {
    res.redirect('/login');
  }
});

// Rutas para profesores (asignar oro a los alumnos)
app.post('/give-gold', (req, res) => {
  const { studentId, amount } = req.body;

  const query = 'UPDATE students SET gold = gold + ? WHERE user_id = ?';
  db.query(query, [amount, studentId], (err, result) => {
    if (err) {
      console.error('Error al dar oro: ', err);
      return res.status(500).send('Error al dar oro');
    }
    res.redirect('/dashboard');
  });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
