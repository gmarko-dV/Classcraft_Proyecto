const express = require('express');
const path = require('path');
const session = require('express-session'); 
const app = express();
const port = 3000;

// Configuración para usar body parser (enviar datos en formularios)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Configurar archivos estáticos (css, js, imágenes)
// Configurar sesión
app.use(session({
  secret: 'mi_clave_secreta',  
  resave: false,
  saveUninitialized: true
}));

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Aseguramos que se usen las vistas en 'views'

// Rutas
const authRoutes = require('./routes/auth');
app.use(authRoutes);

// Ruta para la página principal
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  }
});

// Ruta para dashboard (cuando el usuario está logueado)
app.get('/dashboard', (req, res) => {
  if (req.session.user) {
    // Renderizamos la plantilla con los datos del usuario
    res.render('dashboard', { user: req.session.user });
  } else {
    res.redirect('/login');
  }
});

// Rutas específicas para el profesor (solo si el rol es 'profesor')
app.get('/create-course', (req, res) => {
  if (req.session.user && req.session.user.role === 'profesor') {
    res.send('Crear curso');
  } else {
    res.redirect('/dashboard');
  }
});

app.get('/manage-students', (req, res) => {
  if (req.session.user && req.session.user.role === 'profesor') {
    res.send('Gestionar estudiantes');
  } else {
    res.redirect('/dashboard');
  }
});

app.get('/grade-students', (req, res) => {
  if (req.session.user && req.session.user.role === 'profesor') {
    res.send('Calificar estudiantes');
  } else {
    res.redirect('/dashboard');
  }
});

app.get('/view-reports', (req, res) => {
  if (req.session.user && req.session.user.role === 'profesor') {
    res.send('Ver informes');
  } else {
    res.redirect('/dashboard');
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
