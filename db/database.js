// backend/db/database.js
const { Pool } = require('pg');
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  console.log("INFO (db): Cargando variables de entorno desde .env (desarrollo local)");
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} else {
  console.log("INFO (db): Entorno de producción detectado, no se carga .env");
}

let poolConfig = {};

if (process.env.DATABASE_URL) {
  console.log("INFO (db): Intentando conectar a la base de datos usando DATABASE_URL:", process.env.DATABASE_URL);
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };
  
  // Forzar la configuración SSL para RDS en producción o si la URL lo indica
  // Simplificado: si hay DATABASE_URL y estamos en producción, aplicar la configuración SSL.
  if (process.env.NODE_ENV === 'production') {
    console.log("INFO (db): Entorno de producción y DATABASE_URL presente. Configurando SSL con rejectUnauthorized: false.");
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  } else if (process.env.DATABASE_URL.includes('sslmode=require') || process.env.DATABASE_URL.includes('ssl=true')) {
    // Para desarrollo local si la URL lo especifica
    console.log("INFO (db): DATABASE_URL indica SSL. Configurando SSL con rejectUnauthorized: false.");
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }

} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE && process.env.PGPASSWORD && process.env.PGPORT) {
  // ... (lógica para variables PG* individuales, también podría necesitar forzar SSL si PGHOST no es localhost)
  console.log("INFO (db): DATABASE_URL no encontrada. Intentando conectar con variables PG* individuales...");
  poolConfig = {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT),
  };
  if (process.env.PGHOST !== 'localhost') {
    console.log("INFO (db): PGHOST no es localhost. Configurando SSL con rejectUnauthorized: false.");
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }
} else {
  console.error("ERROR (db): No se encontraron variables de entorno para la conexión a la base de datos.");
}

let pool;
if (Object.keys(poolConfig).length > 0 && (poolConfig.connectionString || (poolConfig.host && poolConfig.user))) {
  try {
    console.log("INFO (db): Inicializando Pool con la configuración:", JSON.stringify(poolConfig, (key, value) => key === 'password' || key === 'connectionString' && typeof value === 'string' && value.includes('postgres://') ? (value.includes('@') ? value.substring(0, value.indexOf(':', value.indexOf('//') + 3)+1) + '********' + value.substring(value.indexOf('@')) : '********') : value, 2));
    pool = new Pool(poolConfig);

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
        console.error("DETALLES DEL ERROR DE CONEXIÓN:", err); // Imprimir el objeto de error completo
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
