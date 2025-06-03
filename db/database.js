const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

let poolConfig;

if (process.env.DATABASE_URL) {
  // Si DATABASE_URL está provista por Railway (o similar)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    // Podrías necesitar configurar SSL para conexiones a bases de datos en la nube
    // ssl: {
    //   rejectUnauthorized: false // Ajusta según los requisitos de tu proveedor de BD
    // }
  };
} else {
  // Configuración para desarrollo local usando variables individuales
  poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
  };
}

const pool = new Pool(poolConfig);

pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error adquiriendo cliente para la prueba de conexión', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Error ejecutando la consulta de prueba', err.stack);
    }
    if (result && result.rows && result.rows.length > 0) {
        console.log('Conexión a PostgreSQL exitosa! Hora actual del servidor de BD:', result.rows[0].now);
    } else {
        console.log('Conexión a PostgreSQL exitosa, pero la consulta de prueba no devolvió filas.');
    }
  });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};