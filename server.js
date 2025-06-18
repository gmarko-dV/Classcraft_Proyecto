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

      let showCreateClassButton = false;
      
      // Si el profesor no tiene clases asignadas, mostramos el botón para crear una nueva clase
      if (classes.length === 0) {
        showCreateClassButton = true;
      }

      // Recuperamos la asignatura del profesor desde la tabla profesores
      const queryTeacherSubject = 'SELECT asignatura FROM profesores WHERE id_usuario = ?';
      db.query(queryTeacherSubject, [req.session.user.id], (err, result) => {
        if (err) {
          console.error('Error al obtener asignatura del profesor: ', err);
          return res.status(500).send('Error al obtener asignatura');
        }

        // Si existe una asignatura, la pasamos a la vista
        const subject = result.length > 0 ? result[0].asignatura : 'Sin asignatura asignada';

        // Si el profesor tiene clases, obtenemos las secciones y estudiantes
        const classIds = classes.map(classItem => classItem.id);  // Obtener todos los IDs de las clases del profesor

        // Verificamos si hay clases para el profesor antes de ejecutar la consulta
        if (classIds.length === 0) {
          // Si no hay clases, redirigir o mostrar mensaje adecuado
          return res.render('dashboard-teacher', {
            user: req.session.user,
            showCreateClassButton,
            message: 'No tienes clases asignadas. Puedes crear una nueva clase.',
            subject // Pasar la asignatura al dashboard
          });
        }

        const querySections = 'SELECT * FROM secciones WHERE id_clase IN (?)';
        db.query(querySections, [classIds], (err, sections) => {
          if (err) {
            console.error('Error al obtener secciones: ', err);
            return res.status(500).send('Error al obtener secciones');
          }

          // Obtener los estudiantes asociados a las clases
          const queryStudents = `SELECT clase_estudiantes.id_clase, clase_estudiantes.id_seccion, usuarios.nombre, usuarios.apellido, usuarios.id AS student_id FROM clase_estudiantes INNER JOIN usuarios ON clase_estudiantes.id_estudiante = usuarios.id WHERE clase_estudiantes.id_clase IN (${classIds.map(() => '?').join(',')})`;
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

            // Renderizar el dashboard del profesor con las clases, secciones, estudiantes y el botón de crear clase
            res.render('dashboard-teacher', { 
              user: req.session.user, 
              studentsByClass, // Pasar la variable studentsByClass
              showCreateClassButton, // Pasar la variable para mostrar el botón si no hay clases
              subject // Pasar la asignatura al dashboard
            });
          });
        });
      });
    });
  } else if (req.session.user.role === 'alumno') {
    const queryStudent = 'SELECT * FROM estudiantes WHERE id_usuario = ?';
    db.query(queryStudent, [req.session.user.id], (err, studentData) => {
      if (err) {
        console.error('Error al obtener datos del alumno: ', err);
        return res.status(500).send('Error al obtener datos del alumno');
      }
      const student = studentData[0];
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

  // Obtener la asignatura del profesor desde la base de datos
  const queryTeacherSubject = 'SELECT asignatura FROM profesores WHERE id_usuario = ?';
  db.query(queryTeacherSubject, [req.session.user.id], (err, result) => {
    if (err) {
      console.error('Error al obtener asignatura del profesor: ', err);
      return res.status(500).send('Error al obtener asignatura');
    }

    // Si existe una asignatura, la pasamos a la vista
    const subject = result.length > 0 ? result[0].asignatura : 'Sin asignatura asignada';

    res.render('create-class', {
      user: req.session.user,
      subject: subject // Pasamos la asignatura a la vista
    });
  });
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

    // Después de crear la clase, comprobamos si el profesor tiene más clases
    const queryClasses = 'SELECT * FROM clases WHERE id_profesor = ?';
    db.query(queryClasses, [req.session.user.id], (err, classes) => {
      if (err) {
        console.error('Error al obtener clases: ', err);
        return res.status(500).send('Error al obtener clases');
      }

      // Si el profesor no tiene clases, mostramos el botón para crear una nueva clase
      let showCreateClassButton = false;
      if (classes.length === 0) {
        showCreateClassButton = true;
      }

      // Recuperamos la asignatura del profesor desde la tabla profesores
      const queryTeacherSubject = 'SELECT asignatura FROM profesores WHERE id_usuario = ?';
      db.query(queryTeacherSubject, [req.session.user.id], (err, result) => {
        if (err) {
          console.error('Error al obtener asignatura del profesor: ', err);
          return res.status(500).send('Error al obtener asignatura');
        }

        const subject = result.length > 0 ? result[0].asignatura : 'Sin asignatura asignada';

        res.render('dashboard-teacher', {
          user: req.session.user,
          showCreateClassButton, // Pasar la variable para mostrar el botón si no tiene clases
          subject // Pasar la asignatura al dashboard
        });
      });
    });
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

    // Verificar si el profesor tiene clases asignadas
    if (classes.length === 0) {
      return res.status(400).send('El profesor no tiene clases asignadas');
    }

    // Obtener los IDs de las clases asignadas al profesor
    const classIds = classes.map(classItem => classItem.id);

    // Obtener las secciones correspondientes a esas clases
    const querySections = 'SELECT * FROM secciones WHERE id_clase IN (?)';
    db.query(querySections, [classIds], (err, sections) => {
      if (err) {
        console.error('Error al obtener secciones: ', err);
        return res.status(500).send('Error al obtener secciones');
      }

      // Obtener los estudiantes que están registrados como alumnos
      const queryStudents = `
        SELECT u.id, u.nombre, u.apellido
        FROM usuarios u
        INNER JOIN estudiantes e ON e.id_usuario = u.id
        WHERE u.rol = 'alumno'`;

      db.query(queryStudents, (err, students) => {
        if (err) {
          console.error('Error al obtener estudiantes: ', err);
          return res.status(500).send('Error al obtener estudiantes');
        }

        // Renderizar la vista para agregar estudiante, pasando las clases, secciones y estudiantes
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

  // Verificar que los datos de clase, sección y estudiante estén presentes
  if (!class_id || !section_id || !student_id) {
    return res.status(400).send('Debe seleccionar una clase, sección y un estudiante.');
  }

  // Verificar que el estudiante no esté ya asignado a la clase y sección
  const queryCheckStudentAssignment = 'SELECT * FROM clase_estudiantes WHERE id_clase = ? AND id_seccion = ? AND id_estudiante = ?';
  db.query(queryCheckStudentAssignment, [class_id, section_id, student_id], (err, result) => {
    if (err) {
      console.error('Error al verificar si el estudiante ya está asignado: ', err);
      return res.status(500).send('Error al verificar asignación del estudiante');
    }

    if (result.length > 0) {
      return res.status(400).send('El estudiante ya está asignado a esta clase y sección.');
    }

    // Insertar el estudiante en la clase y sección seleccionada
    const queryInsertStudentToClass = 'INSERT INTO clase_estudiantes (id_clase, id_seccion, id_estudiante) VALUES (?, ?, ?)';
    db.query(queryInsertStudentToClass, [class_id, section_id, student_id], (err, result) => {
      if (err) {
        console.error('Error al agregar estudiante a la clase: ', err);
        return res.status(500).send('Error al agregar estudiante');
      }

      // Si todo está bien, redirigir al dashboard del profesor
      res.redirect('/dashboard');
    });
  });
});


// Ruta GET para mostrar el formulario de edición de sección del estudiante
app.get('/edit-student-assignment/:student_id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'profesor') {
    return res.redirect('/login');
  }

  const student_id = req.params.student_id;

  // Obtener las clases del profesor
  const queryClasses = 'SELECT * FROM clases WHERE id_profesor = ?';
  db.query(queryClasses, [req.session.user.id], (err, classes) => {
    if (err) {
      console.error('Error al obtener clases: ', err);
      return res.status(500).send('Error al obtener clases');
    }

    if (classes.length === 0) {
      return res.status(400).send('El profesor no tiene clases asignadas');
    }

    const classIds = classes.map(classItem => classItem.id);

    // Corregir la consulta de secciones
    const querySections = `SELECT * FROM secciones WHERE id_clase IN (${classIds.map(() => '?').join(',')})`;
    db.query(querySections, classIds, (err, sections) => {
      if (err) {
        console.error('Error al obtener secciones: ', err);
        return res.status(500).send('Error al obtener secciones');
      }

      // CORREGIDO: Agregar id_estudiante a la consulta
      const queryStudent = `
        SELECT e.id_estudiante, e.id_clase, e.id_seccion
        FROM clase_estudiantes e
        WHERE e.id_estudiante = ?`;

      db.query(queryStudent, [student_id], (err, studentData) => {
        if (err) {
          console.error('Error al obtener datos del estudiante: ', err);
          return res.status(500).send('Error al obtener datos del estudiante');
        }

        if (studentData.length === 0) {
          return res.status(404).send('Estudiante no encontrado');
        }

        res.render('edit-student-assignment', {
          user: req.session.user,
          classes,
          sections,
          student: studentData[0]
        });
      });
    });
  });
});



// Ruta POST para actualizar la asignación de un estudiante
app.post('/edit-student-assignment/:student_id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'profesor') {
    return res.redirect('/login');
  }

  const student_id = req.params.student_id;
  const { class_id, section_id } = req.body;

  if (!class_id || !section_id) {
    return res.status(400).send('Debe seleccionar una clase y una sección.');
  }

  const queryUpdateAssignment = `
    UPDATE clase_estudiantes
    SET id_clase = ?, id_seccion = ?
    WHERE id_estudiante = ?`;

  db.query(queryUpdateAssignment, [class_id, section_id, student_id], (err, result) => {
    if (err) {
      console.error('Error al actualizar asignación del estudiante: ', err);
      return res.status(500).send('Error al actualizar asignación');
    }

    if (result.affectedRows === 0) {
      return res.status(404).send('Estudiante no encontrado');
    }

    res.redirect('/dashboard');
  });
});


// Escuchar en el puerto 3000
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
