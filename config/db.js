const mysql = require('mysql2');

// Crear la conexión con la base de datos MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Tu usuario de MySQL
  password: '123456', // Tu contraseña de MySQL
  database: 'classcraft' // El nombre de tu base de datos
});

// Conectar a la base de datos
connection.connect((err) => {
  if (err) {
    console.error('Error de conexión a la base de datos: ', err);
  } else {
    console.log('Conexión exitosa a la base de datos');
  }
});

module.exports = connection;
