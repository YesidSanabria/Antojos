// backend/db/database.js
const { Pool } = require('pg');
const path = require('path'); // Para construir rutas de archivo de forma segura

// Carga las variables de entorno desde el archivo .env en la carpeta 'backend'
// SOLO si no estamos en un entorno de producción (como Railway, que inyecta las variables)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

let poolConfig = {};

if (process.env.DATABASE_URL) {
  // Opción 1: Usar DATABASE_URL (recomendado si Railway la provee)
  // Esta URL usualmente ya viene configurada por Railway para manejar SSL si es necesario.
  console.log("INFO: Intentando conectar a la base de datos usando DATABASE_URL...");
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    // Si Railway requiere SSL y no está en la connectionString (raro), puedes añadir:
    // ssl: {
    //   rejectUnauthorized: false // ¡PRECAUCIÓN en producción! Usar solo si es estrictamente necesario y entiendes las implicaciones.
    // }
  };
} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE && process.env.PGPASSWORD && process.env.PGPORT) {
  // Opción 2: Usar variables PG* individuales si DATABASE_URL no está disponible
  console.log("INFO: DATABASE_URL no encontrada. Intentando conectar con variables PG* individuales...");
  poolConfig = {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT), // El puerto debe ser un número
    // Considera SSL aquí también si es necesario para conexiones directas y no lo maneja la plataforma
    // ssl: {
    //   rejectUnauthorized: false
    // }
  };
} else {
  console.error("ERROR: No se encontraron variables de entorno para la conexión a la base de datos (ni DATABASE_URL ni el conjunto completo de PG*).");
  // Podrías optar por lanzar un error aquí o manejarlo de otra forma si la BD es crítica para el inicio.
  // throw new Error("Faltan variables de configuración para la base de datos.");
}

// Solo crea el pool si tenemos una configuración válida
let pool;
if (Object.keys(poolConfig).length > 0) {
  pool = new Pool(poolConfig);

  // Prueba de conexión y consulta
  pool.query('SELECT NOW()')
    .then(res => {
      if (res.rows[0]) {
        console.log('SUCCESS: Conexión a PostgreSQL exitosa. Hora del servidor de BD:', res.rows[0].now);
      } else {
        console.warn('WARNING: Conexión a PostgreSQL exitosa, pero la consulta de prueba no devolvió filas.');
      }
    })
    .catch(err => {
      console.error('ERROR: Falló la conexión de prueba a PostgreSQL o la consulta inicial.');
      console.error(err.stack);
    });
} else {
  console.warn("WARNING: El pool de la base de datos no se inicializó debido a falta de configuración.");
}

module.exports = {
  query: (text, params) => {
    if (!pool) {
      return Promise.reject(new Error("El pool de la base de datos no está inicializado."));
    }
    return pool.query(text, params);
  },

  getPool: () => pool,
};