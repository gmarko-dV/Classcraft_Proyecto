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

        const subject = result.length > 0 ? result[0].asignatura : 'Sin asignatura asignada';

        // Si el profesor tiene clases, obtenemos las secciones y estudiantes
        const classIds = classes.map(classItem => classItem.id);  // Obtener todos los IDs de las clases del profesor

        if (classIds.length === 0) {
          return res.render('dashboard-teacher', {
            user: req.session.user,
            showCreateClassButton,
            message: 'No tienes clases asignadas. Puedes crear una nueva clase.',
            subject
          });
        }

        const querySections = 'SELECT * FROM secciones WHERE id_clase IN (?)';
        db.query(querySections, [classIds], (err, sections) => {
          if (err) {
            console.error('Error al obtener secciones: ', err);
            return res.status(500).send('Error al obtener secciones');
          }

          // Obtener los estudiantes asociados a las clases y secciones
          const queryStudents = `
            SELECT 
              ce.id_clase, 
              ce.id_seccion, 
              u.nombre, 
              u.apellido, 
              u.id AS student_id
            FROM 
              clase_estudiantes ce
            INNER JOIN usuarios u ON ce.id_estudiante = u.id
            WHERE 
              ce.id_clase IN (?)`;

          db.query(queryStudents, [classIds], (err, students) => {
            if (err) {
              console.error('Error al obtener estudiantes: ', err);
              return res.status(500).send('Error al obtener estudiantes');
            }

            // Agrupar estudiantes por clase y sección
            const studentsByClass = classes.map(classItem => {
              const classSections = sections.filter(section => section.id_clase === classItem.id);
              const classStudents = students.filter(student => student.id_clase === classItem.id);

              const sectionsWithStudents = classSections.map(section => {
                return {
                  section: section,
                  students: classStudents.filter(student => student.id_seccion === section.id)
                };
              });

              return {
                class: classItem,
                sections: sectionsWithStudents
              };
            });

            res.render('dashboard-teacher', { 
              user: req.session.user, 
              studentsByClass, 
              showCreateClassButton, 
              subject 
            });
          });
        });
      });
    });
  } else if (req.session.user.role === 'alumno') {
    // Obtener información del estudiante (incluyendo clase, sección y artículos comprados)
    const queryStudent = `
      SELECT 
        u.nombre, u.apellido, u.id AS student_id, 
        e.oro, e.personaje, e.hp, e.xp, 
        c.nombre AS clase, s.nombre AS seccion,
        a.nombre AS articulo_comprado
      FROM estudiantes e
      INNER JOIN usuarios u ON e.id_usuario = u.id
      LEFT JOIN clase_estudiantes ce ON e.id_usuario = ce.id_estudiante
      LEFT JOIN clases c ON ce.id_clase = c.id
      LEFT JOIN secciones s ON ce.id_seccion = s.id
      LEFT JOIN compras comp ON comp.id_estudiante = u.id
      LEFT JOIN articulos_tienda a ON comp.id_articulo = a.id
      WHERE u.id = ?`;

    db.query(queryStudent, [req.session.user.id], (err, studentData) => {
      if (err) {
        console.error('Error al obtener datos del alumno: ', err);
        return res.status(500).send('Error al obtener datos del alumno');
      }

      const student = studentData[0]; // Tomamos el primer (y único) resultado
      res.render('dashboard-student', { user: req.session.user, student });
    });
  } else {
    res.status(403).send('Acco no autorizado');
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


// Ruta para mostrar la página de la ruleta
app.get('/roulette', (req, res) => {
    try {
        // Obtener estudiantes de la base de datos
        const query = 'SELECT id_usuario, nombre, apellido FROM estudiantes INNER JOIN usuarios ON estudiantes.id_usuario = usuarios.id WHERE usuarios.rol = "alumno"';
        db.query(query, (err, result) => {
            if (err) {
                console.error('Error al obtener estudiantes:', err);
                return res.status(500).send('Error al obtener estudiantes');
            }

            // Datos del juego
            const gameData = {
                playerName: req.session?.playerName || 'Jugador',
                currentXP: req.session?.xp || 0,
                currentHP: req.session?.hp || 100,
                currentGold: req.session?.gold || 0,
                students: result // Los estudiantes obtenidos de la base de datos
            };

            // Renderizar la vista de la ruleta
            res.render('ruleta', { 
                title: 'Ruleta del Destino',
                gameData: gameData
            });
        });
    } catch (error) {
        console.error('Error al cargar la ruleta:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta para manejar las acciones de recompensas y castigos
app.post('/applyReward', (req, res) => {
    const { studentId, action, value } = req.body;  // Obtener datos del formulario

    let query = '';
    let values = [];

    // Según la acción seleccionada, armamos la consulta SQL
    if (action === 'oro_add') {
        query = 'UPDATE estudiantes SET oro = oro + ? WHERE id_usuario = ?';
        values = [value, studentId];
    } else if (action === 'xp_add') {
        query = 'UPDATE estudiantes SET xp = xp + ? WHERE id_usuario = ?';
        values = [value, studentId];
    } else if (action === 'hp_sub') {
        query = 'UPDATE estudiantes SET hp = hp - ? WHERE id_usuario = ?';
        values = [value, studentId];
    } else if (action === 'xp_sub') {
        query = 'UPDATE estudiantes SET xp = xp - ? WHERE id_usuario = ?';
        values = [value, studentId];
    }

    // Ejecutar la consulta SQL
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error al aplicar la recompensa o castigo:', err);
            return res.status(500).send('Error al aplicar recompensa o castigo');
        }

        // Responder con éxito
        res.json({ success: true, message: 'Acción aplicada correctamente' });
    });
});


// Ruta para mostrar los artículos en la tienda
app.get('/store', (req, res) => {
  const queryItems = 'SELECT * FROM articulos_tienda';  // Obtener todos los artículos de la tienda

  db.query(queryItems, (err, items) => {
    if (err) {
      console.error('Error al obtener los artículos: ', err);
      return res.status(500).send('Error al obtener los artículos');
    }

    // Renderizar la tienda pasando los artículos a la vista
    res.render('store', { user: req.session.user, articulos: items });
  });
});


// Ruta para realizar una compra
app.post('/comprar', (req, res) => {
  const { id_estudiante, id_articulo } = req.body;  // ID del estudiante y el artículo

  // Obtener el precio del artículo
  const queryArticulo = 'SELECT precio FROM articulos_tienda WHERE id = ?';
  db.query(queryArticulo, [id_articulo], (err, result) => {
    if (err) {
      console.error('Error al obtener el precio del artículo:', err);
      return res.status(500).json({ message: 'Ocurrió un error al procesar tu compra. Por favor, intenta nuevamente.' });
    }

    const precio = result[0].precio;

    // Obtener el oro del estudiante
    const queryOro = 'SELECT oro FROM estudiantes WHERE id_usuario = ?';
    db.query(queryOro, [id_estudiante], (err, result) => {
      if (err) {
        console.error('Error al obtener el oro del estudiante:', err);
        return res.status(500).json({ message: 'Ocurrió un error al procesar tu compra. Por favor, intenta nuevamente.' });
      }

      const oroDisponible = result[0].oro;

      // Verificar si el estudiante tiene suficiente oro
      if (oroDisponible < precio) {
        console.error('El estudiante no tiene suficiente oro:', { id_estudiante, oroDisponible, precio });
        return res.status(400).json({ message: 'No tienes suficiente oro para realizar esta compra.' });
      }

      // Restar el oro al estudiante
      const nuevoOro = oroDisponible - precio;
      const queryActualizarOro = 'UPDATE estudiantes SET oro = ? WHERE id_usuario = ?';
      db.query(queryActualizarOro, [nuevoOro, id_estudiante], (err, result) => {
        if (err) {
          console.error('Error al actualizar el oro del estudiante:', err);
          return res.status(500).json({ message: 'Ocurrió un error al procesar tu compra. Por favor, intenta nuevamente.' });
        }

        // Registrar la compra en la tabla 'compras'
        const queryCompra = 'INSERT INTO compras (id_estudiante, id_articulo) VALUES (?, ?)';
        db.query(queryCompra, [id_estudiante, id_articulo], (err, result) => {
          if (err) {
            console.error('Error al registrar la compra:', err);
            return res.status(500).json({ message: 'Ocurrió un error al procesar tu compra. Por favor, intenta nuevamente.' });
          }

          // Solo mostrar el mensaje en consola
          console.log('Compra realizada con éxito');

          // Responder con el mensaje de éxito
          res.status(200).json({ message: 'Compra realizada con éxito' });
        });
      });
    });
  });
});


// Escuchar en el puerto 3000
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
