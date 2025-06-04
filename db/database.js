// backend/db/database.js
const { Pool } = require('pg');
const path = require('path'); // Para construir rutas de archivo de forma segura

// Carga las variables de entorno desde el archivo .env
// SOLO si no estamos en un entorno de producción (como App Runner)
if (process.env.NODE_ENV !== 'production') {
  console.log("INFO (db): Cargando variables de entorno desde .env (desarrollo local)");
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} else {
  console.log("INFO (db): Entorno de producción detectado, no se carga .env");
}

let poolConfig = {};
let usingSsl = false; // Para saber si debemos añadir la opción SSL

if (process.env.DATABASE_URL) {
  console.log("INFO (db): Intentando conectar a la base de datos usando DATABASE_URL...");
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };
  // Verificar si la connectionString indica que se usará SSL
  // RDS con ?sslmode=require o ?ssl=true lo necesitará.
  if (process.env.DATABASE_URL.includes('sslmode=require') || process.env.DATABASE_URL.includes('ssl=true')) {
    usingSsl = true;
  }
} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE && process.env.PGPASSWORD && process.env.PGPORT) {
  console.log("INFO (db): DATABASE_URL no encontrada. Intentando conectar con variables PG* individuales...");
  poolConfig = {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT),
  };
  // Aquí podrías añadir una variable de entorno explícita como PGSSLMODE=require
  // o asumir que si no es localhost, probablemente necesite SSL.
  // Por simplicidad, si no es localhost, asumiremos que podría necesitar SSL.
  if (process.env.PGHOST !== 'localhost') {
    usingSsl = true; // Asumimos que las conexiones remotas a PG podrían necesitar SSL
  }
} else {
  console.error("ERROR (db): No se encontraron variables de entorno para la conexión a la base de datos (ni DATABASE_URL ni el conjunto completo de PG*).");
}

// Si se determinó que se usa SSL, añadir la opción para permitir certificados autofirmados (común para RDS)
if (usingSsl) {
  console.log("INFO (db): Configurando SSL con rejectUnauthorized: false para la conexión.");
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

// Solo crea el pool si tenemos una configuración válida
let pool;
if (Object.keys(poolConfig).length > 0 && poolConfig.connectionString || (poolConfig.host && poolConfig.user && poolConfig.database && poolConfig.password && poolConfig.port)) {
  try {
    pool = new Pool(poolConfig);

    // Prueba de conexión y consulta
    pool.query('SELECT NOW()')
      .then(res => {
        if (res.rows && res.rows[0]) {
          console.log('SUCCESS (db): Conexión a PostgreSQL exitosa. Hora del servidor de BD:', res.rows[0].now);
        } else {
          console.warn('WARN (db): Conexión a PostgreSQL exitosa, pero la consulta de prueba no devolvió filas.');
        }
      })
      .catch(err => {
        console.error('ERROR (db): Falló la conexión de prueba a PostgreSQL o la consulta inicial.');
        console.error(err.stack);
      });
  } catch (initError) {
    console.error("ERROR (db): No se pudo inicializar el Pool de PostgreSQL. Verifica la configuración.", initError.stack);
  }
} else {
  console.warn("WARN (db): El pool de la base de datos no se inicializó debido a falta de configuración completa.");
}

module.exports = {
  query: (text, params) => {
    if (!pool) {
      console.error("ERROR (db query): Intento de usar query() pero el pool no está inicializado.");
      return Promise.reject(new Error("El pool de la base de datos no está inicializado."));
    }
    return pool.query(text, params);
  },
  getPool: () => pool,
};
