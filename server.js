const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./config/db');
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

// Importar las rutas de auth.js
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
  if (!req.session.user) {
    return res.redirect('/login');  // Si no está logueado, redirigir al login
  }

  // Si el usuario es un profesor
  if (req.session.user.role === 'profesor') {
    // Obtener las clases del profesor
    const queryClasses = 'SELECT * FROM clases WHERE id_profesor = ?';
    db.query(queryClasses, [req.session.user.id], (err, classes) => {
      if (err) {
        console.error('Error al obtener clases: ', err);
        return res.status(500).send('Error al obtener clases');
      }

      // Si el profesor no tiene clases asignadas
      if (classes.length === 0) {
        return res.render('dashboard-teacher', { 
          user: req.session.user, 
          message: 'No tienes clases asignadas. Puedes crear una nueva clase.', 
          showCreateClassButton: true, // Solo mostrar este mensaje si no tiene clases
        });
      }

      // Si el profesor tiene clases, obtenemos las secciones y estudiantes
      const classIds = classes.map(classItem => classItem.id);  // Obtener todos los IDs de las clases del profesor

      const querySections = 'SELECT * FROM secciones WHERE id_clase IN (?)';
      db.query(querySections, [classIds], (err, sections) => {
        if (err) {
          console.error('Error al obtener secciones: ', err);
          return res.status(500).send('Error al obtener secciones');
        }

        // Obtener los estudiantes asociados a las clases
        const queryStudents = `
          SELECT clase_estudiantes.id_clase, clase_estudiantes.id_seccion, usuarios.nombre, usuarios.apellido, usuarios.id AS student_id
          FROM clase_estudiantes
          INNER JOIN usuarios ON clase_estudiantes.id_estudiante = usuarios.id
          WHERE clase_estudiantes.id_clase IN (${classIds.map(() => '?').join(',')})
        `;

        db.query(queryStudents, classIds, (err, students) => {
          if (err) {
            console.error('Error al obtener estudiantes: ', err);
            return res.status(500).send('Error al obtener estudiantes');
          }

          // Agrupar estudiantes por clase y sección
          const studentsByClass = classes.map(classItem => {
            const classSections = sections.filter(section => section.id_clase === classItem.id);
            const classStudents = students.filter(student => student.id_clase === classItem.id);

            return {
              class: classItem,
              sections: classSections,
              students: classStudents
            };
          });

          // Renderizar el dashboard del profesor con las clases, secciones y estudiantes
          res.render('dashboard-teacher', { 
            user: req.session.user, 
            studentsByClass, // Pasar la variable studentsByClass
            showCreateClassButton: false, // No mostrar el botón si tiene clases
          });
        });
      });
    });
  } 

  // Si el usuario es un estudiante
  else if (req.session.user.role === 'alumno') {
    // Obtener los datos del estudiante (por ejemplo, oro, personaje)
    const queryStudent = 'SELECT * FROM estudiantes WHERE id_usuario = ?';
    db.query(queryStudent, [req.session.user.id], (err, studentData) => {
      if (err) {
        console.error('Error al obtener datos del alumno: ', err);
        return res.status(500).send('Error al obtener datos del alumno');
      }

      // Asumimos que hay solo un registro para el estudiante
      const student = studentData[0];

      // Renderizar el dashboard del alumno con sus datos
      res.render('dashboard-student', { user: req.session.user, student });
    });
  } else {
    res.status(403).send('Acceso no autorizado');
  }
});

// Ruta para mostrar el formulario de creación de clase
app.get('/create-class', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'profesor') {
    return res.redirect('/login');  // Si no está logueado o no es profesor, redirigir al login
  }
  res.render('create-class', { user: req.session.user }); // Renderizar la vista de creación de clase
});

// Ruta POST para crear la clase
app.post('/create-class', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'profesor') {
    return res.redirect('/login');
  }

  const { className, subject } = req.body;

  const queryCreateClass = 'INSERT INTO clases (nombre, asignatura, id_profesor) VALUES (?, ?, ?)';
  db.query(queryCreateClass, [className, subject, req.session.user.id], (err, result) => {
    if (err) {
      console.error('Error al crear clase: ', err);
      return res.status(500).send('Error al crear clase');
    }

    res.redirect('/dashboard');  // Redirige al dashboard después de crear la clase
  });
});

// Ruta para mostrar el formulario de agregar estudiante
app.get('/add-student', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'profesor') {
    return res.redirect('/login');  // Si no está logueado o no es profesor, redirigir al login
  }

  // Obtener las clases del profesor
  const queryClasses = 'SELECT * FROM clases WHERE id_profesor = ?';
  db.query(queryClasses, [req.session.user.id], (err, classes) => {
    if (err) {
      console.error('Error al obtener clases: ', err);
      return res.status(500).send('Error al obtener clases');
    }

    if (classes.length === 0) {
      // Si el profesor no tiene clases, devolver un mensaje adecuado
      return res.status(400).send('El profesor no tiene clases asignadas');
    }

    // Obtener las secciones de las clases
    const classIds = classes.map(classItem => classItem.id);  // Obtener todos los IDs de las clases del profesor

    // Verificar si classIds no está vacío
    if (classIds.length === 0) {
      return res.status(400).send('No se encontraron clases para este profesor.');
    }

    const querySections = 'SELECT * FROM secciones WHERE id_clase IN (?)';
    db.query(querySections, [classIds], (err, sections) => {
      if (err) {
        console.error('Error al obtener secciones: ', err);
        return res.status(500).send('Error al obtener secciones');
      }

      // Obtener los estudiantes asociados a las clases
      const queryStudents = `
        SELECT clase_estudiantes.id_clase, clase_estudiantes.id_seccion, usuarios.nombre, usuarios.apellido, usuarios.id AS student_id
        FROM clase_estudiantes
        INNER JOIN usuarios ON clase_estudiantes.id_estudiante = usuarios.id
        WHERE clase_estudiantes.id_clase IN (${classIds.map(() => '?').join(',')})
      `;
      db.query(queryStudents, classIds, (err, students) => {
        if (err) {
          console.error('Error al obtener estudiantes: ', err);
          return res.status(500).send('Error al obtener estudiantes');
        }

        // Pasar las clases, secciones y estudiantes a la vista
        res.render('add-student', { 
          user: req.session.user, 
          classes, 
          sections, 
          students 
        });
      });
    });
  });
});

// Ruta POST para agregar estudiante a la clase
app.post('/add-student', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'profesor') {
    return res.redirect('/login');  // Si no está logueado o no es profesor, redirigir al login
  }

  const { class_id, section_id, student_id } = req.body;

  // Verificar si los datos están completos
  if (!class_id || !section_id || !student_id) {
    return res.status(400).send('Debe seleccionar una clase, sección y un estudiante.');
  }

  // Insertar el estudiante en la clase y sección seleccionada
  const queryInsertStudentToClass = 'INSERT INTO clase_estudiantes (id_clase, id_seccion, id_estudiante) VALUES (?, ?, ?)';
  db.query(queryInsertStudentToClass, [class_id, section_id, student_id], (err, result) => {
    if (err) {
      console.error('Error al agregar estudiante a la clase: ', err);
      return res.status(500).send('Error al agregar estudiante');
    }

    res.redirect('/dashboard');  // Redirigir al dashboard después de agregar el estudiante
  });
});

// Escuchar en el puerto 3000
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
