// server.js (Raíz del proyecto)
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  console.log("INFO: Cargando variables de entorno desde .env (desarrollo local)");
  require('dotenv').config();
} else {
  console.log("INFO: Entorno de producción detectado, no se carga .env");
}

console.log("INFO: Iniciando aplicación...");
console.log("INFO: NODE_ENV =", process.env.NODE_ENV);
console.log("INFO: PORT (antes de db) =", process.env.PORT); // Ver qué puerto tenemos aquí
console.log("INFO: DATABASE_URL (antes de db) =", process.env.DATABASE_URL ? "DATABASE_URL está presente" : "DATABASE_URL NO está presente");
console.log("INFO: FRONTEND_URL (antes de db) =", process.env.FRONTEND_URL);


const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

console.log("INFO: Importando módulo de base de datos...");
const db = require('./db/database'); // Importa tu módulo de base de datos
console.log("INFO: Módulo de base de datos importado.");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"]
};
console.log("INFO: Opciones de CORS configuradas:", JSON.stringify(corsOptions));


const io = new Server(server, {
  cors: corsOptions
});

// --- Middlewares de Express ---
app.use(cors(corsOptions));
console.log("INFO: Middleware CORS aplicado.");

app.use(express.json());
console.log("INFO: Middleware express.json aplicado.");

app.use(express.urlencoded({ extended: true }));
console.log("INFO: Middleware express.urlencoded aplicado.");


// --- Rutas de API ---
console.log("INFO: Configurando rutas de API...");

// Ruta de salud
app.get('/api/health', (req, res) => {
  console.log(`INFO: Petición GET recibida en /api/health desde ${req.ip}`);
  try {
    res.status(200).json({ status: "UP", message: "El servidor backend está saludable!" });
    console.log("INFO: /api/health respondió 200 OK");
  } catch (e) {
    console.error("ERROR en /api/health:", e.stack);
    res.status(500).json({ status: "DOWN", error: "Error en health check", details: e.message });
  }
});
console.log("INFO: Ruta /api/health configurada.");

// Ruta de prueba de base de datos
app.get('/api/db-test', async (req, res) => {
  console.log(`INFO: Petición GET recibida en /api/db-test desde ${req.ip}`);
  try {
    console.log("INFO: /api/db-test - Intentando consulta a la BD...");
    const result = await db.query('SELECT $1::text as message', ['¡Conexión a BD exitosa desde la API!']);
    if (result && result.rows && result.rows.length > 0) {
      res.status(200).json({ dbMessage: result.rows[0].message });
      console.log("INFO: /api/db-test - Consulta a BD exitosa:", result.rows[0].message);
    } else {
      console.warn("WARN: /api/db-test - Consulta a BD exitosa pero sin filas o formato inesperado.");
      res.status(200).json({ dbMessage: "Consulta a BD aparentemente exitosa, pero sin mensaje de retorno esperado." });
    }
  } catch (err) {
    console.error("ERROR crítico en /api/db-test:", err.stack);
    res.status(500).json({ error: 'Error al conectar o consultar la base de datos', details: err.message });
  }
});
console.log("INFO: Ruta /api/db-test configurada.");

// --- CRUD para Productos ---
// (Tu código CRUD para productos aquí, puedes añadir console.log similares dentro de cada ruta si quieres)
console.log("INFO: Rutas CRUD para productos configuradas.");
// CREATE: Añadir un nuevo producto
app.post('/api/productos', async (req, res) => {
  console.log(`INFO: Petición POST recibida en /api/productos desde ${req.ip}`);
  const { nombre, descripcion, precio, categoria, disponible, stock_quantity } = req.body;
  if (!nombre || precio === undefined) {
    console.warn("WARN: /api/productos - Faltan campos obligatorios (nombre o precio)");
    return res.status(400).json({ error: 'Los campos nombre y precio son obligatorios.' });
  }
  try {
    const queryText = `
      INSERT INTO productos (nombre, descripcion, precio, categoria, disponible, stock_quantity) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *;
    `;
    const values = [
      nombre,
      descripcion,
      parseFloat(precio),
      categoria,
      disponible === undefined ? true : disponible,
      stock_quantity === undefined ? 0 : parseInt(stock_quantity)
    ];
    const { rows } = await db.query(queryText, values);
    res.status(201).json(rows[0]);
    console.log("INFO: /api/productos - Producto creado:", rows[0].id);
  } catch (err) {
    console.error("ERROR al crear el producto:", err.stack);
    if (err.code === '23505' && err.constraint === 'productos_nombre_key') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al crear el producto', details: err.message });
  }
});

// READ: Obtener todos los productos
app.get('/api/productos', async (req, res) => {
  console.log(`INFO: Petición GET recibida en /api/productos desde ${req.ip}`);
  try {
    const { rows } = await db.query('SELECT * FROM productos ORDER BY nombre ASC');
    res.status(200).json(rows);
    console.log(`INFO: /api/productos - Se devolvieron ${rows.length} productos.`);
  } catch (err) {
    console.error("ERROR al obtener productos:", err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener productos', details: err.message });
  }
});

// READ: Obtener un producto por ID
app.get('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición GET recibida en /api/productos/${id} desde ${req.ip}`);
  try {
    const { rows } = await db.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (rows.length === 0) {
      console.warn(`WARN: /api/productos/${id} - Producto no encontrado.`);
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/productos/${id} - Producto encontrado y devuelto.`);
  } catch (err) {
    console.error(`ERROR al obtener el producto con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener el producto', details: err.message });
  }
});

// UPDATE: Actualizar un producto existente por ID
app.put('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición PUT recibida en /api/productos/${id} desde ${req.ip}`);
  const { nombre, descripcion, precio, categoria, disponible, stock_quantity } = req.body;
  if (!nombre || precio === undefined) {
    console.warn(`WARN: /api/productos/${id} (PUT) - Faltan campos obligatorios (nombre o precio)`);
    return res.status(400).json({ error: 'Los campos nombre y precio son obligatorios para la actualización.' });
  }
  try {
    const queryText = `
      UPDATE productos 
      SET 
        nombre = $1, 
        descripcion = $2, 
        precio = $3, 
        categoria = $4, 
        disponible = $5, 
        stock_quantity = $6,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $7 
      RETURNING *;
    `;
    const values = [
        nombre, 
        descripcion, 
        parseFloat(precio), 
        categoria, 
        disponible === undefined ? true : disponible,
        stock_quantity === undefined ? 0 : parseInt(stock_quantity), 
        id
    ];
    const { rows } = await db.query(queryText, values);
    if (rows.length === 0) {
      console.warn(`WARN: /api/productos/${id} (PUT) - Producto no encontrado para actualizar.`);
      return res.status(404).json({ error: 'Producto no encontrado para actualizar' });
    }
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/productos/${id} (PUT) - Producto actualizado.`);
  } catch (err) {
    console.error(`ERROR al actualizar el producto con ID ${id}:`, err.stack);
    if (err.code === '23505' && err.constraint === 'productos_nombre_key') {
      return res.status(409).json({ error: 'Ya existe otro producto con ese nombre.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al actualizar el producto', details: err.message });
  }
});

// DELETE: Eliminar un producto por ID
app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición DELETE recibida en /api/productos/${id} desde ${req.ip}`);
  try {
    const { rows } = await db.query('DELETE FROM productos WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) {
      console.warn(`WARN: /api/productos/${id} (DELETE) - Producto no encontrado para eliminar.`);
      return res.status(404).json({ error: 'Producto no encontrado para eliminar' });
    }
    res.status(204).send(); 
    console.log(`INFO: /api/productos/${id} (DELETE) - Producto eliminado.`);
  } catch (err) {
    console.error(`ERROR al eliminar el producto con ID ${id}:`, err.stack);
    if (err.code === '23503') { 
        return res.status(409).json({ error: 'No se puede eliminar el producto porque está referenciado en items_pedido existentes.', constraint: err.constraint });
    }
    res.status(500).json({ error: 'Error interno del servidor al eliminar el producto', details: err.message });
  }
});


// --- CRUD para Mesas ---
// (Tu código CRUD para mesas aquí, puedes añadir console.log similares)
console.log("INFO: Rutas CRUD para mesas configuradas.");
// CREATE: Añadir una nueva mesa
app.post('/api/mesas', async (req, res) => {
  console.log(`INFO: Petición POST recibida en /api/mesas desde ${req.ip}`);
  const { numero_mesa, descripcion, capacidad, activa } = req.body;

  if (numero_mesa === undefined || numero_mesa === null) {
    console.warn("WARN: /api/mesas - Falta numero_mesa");
    return res.status(400).json({ error: 'El campo numero_mesa es obligatorio.' });
  }
  if (isNaN(parseInt(numero_mesa))) {
    console.warn("WARN: /api/mesas - numero_mesa no es un número");
    return res.status(400).json({ error: 'El campo numero_mesa debe ser un número.' });
  }

  try {
    const queryText = `
      INSERT INTO mesas (numero_mesa, descripcion, capacidad, activa) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *;
    `;
    const values = [
      parseInt(numero_mesa),
      descripcion,
      capacidad === undefined ? 2 : parseInt(capacidad),
      activa === undefined ? true : activa
    ];
    
    const { rows } = await db.query(queryText, values);
    res.status(201).json(rows[0]);
    console.log("INFO: /api/mesas - Mesa creada:", rows[0].id);
  } catch (err) {
    console.error("ERROR al crear la mesa:", err.stack);
    if (err.code === '23505' && err.constraint === 'mesas_numero_mesa_key') {
      return res.status(409).json({ error: 'Ya existe una mesa con ese número.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al crear la mesa', details: err.message });
  }
});

// READ: Obtener todas las mesas
app.get('/api/mesas', async (req, res) => {
  console.log(`INFO: Petición GET recibida en /api/mesas desde ${req.ip}`);
  try {
    const { rows } = await db.query('SELECT * FROM mesas ORDER BY numero_mesa ASC');
    res.status(200).json(rows);
    console.log(`INFO: /api/mesas - Se devolvieron ${rows.length} mesas.`);
  } catch (err) {
    console.error("ERROR al obtener las mesas:", err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener las mesas', details: err.message });
  }
});

// READ: Obtener una mesa por ID
app.get('/api/mesas/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición GET recibida en /api/mesas/${id} desde ${req.ip}`);
  try {
    const { rows } = await db.query('SELECT * FROM mesas WHERE id = $1', [id]);
    if (rows.length === 0) {
      console.warn(`WARN: /api/mesas/${id} - Mesa no encontrada.`);
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/mesas/${id} - Mesa encontrada y devuelta.`);
  } catch (err) {
    console.error(`ERROR al obtener la mesa con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener la mesa', details: err.message });
  }
});

// UPDATE: Actualizar una mesa existente por ID
app.put('/api/mesas/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición PUT recibida en /api/mesas/${id} desde ${req.ip}`);
  const { numero_mesa, descripcion, capacidad, activa } = req.body;

  if (numero_mesa === undefined || numero_mesa === null) {
    console.warn(`WARN: /api/mesas/${id} (PUT) - Falta numero_mesa`);
    return res.status(400).json({ error: 'El campo numero_mesa es obligatorio para la actualización.' });
  }
   if (isNaN(parseInt(numero_mesa))) {
    console.warn(`WARN: /api/mesas/${id} (PUT) - numero_mesa no es un número`);
    return res.status(400).json({ error: 'El campo numero_mesa debe ser un número.' });
  }

  try {
    const queryText = `
      UPDATE mesas 
      SET 
        numero_mesa = $1, 
        descripcion = $2, 
        capacidad = $3, 
        activa = $4
        -- Si NO tienes el trigger 'set_timestamp_mesas', añade: , updated_at = CURRENT_TIMESTAMP 
      WHERE id = $5 
      RETURNING *;
    `;
    const values = [
        parseInt(numero_mesa), 
        descripcion, 
        capacidad === undefined ? null : parseInt(capacidad),
        activa === undefined ? null : activa,
        id
    ];
    
    const { rows } = await db.query(queryText, values);
    
    if (rows.length === 0) {
      console.warn(`WARN: /api/mesas/${id} (PUT) - Mesa no encontrada para actualizar.`);
      return res.status(404).json({ error: 'Mesa no encontrada para actualizar' });
    }
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/mesas/${id} (PUT) - Mesa actualizada.`);
  } catch (err) {
    console.error(`ERROR al actualizar la mesa con ID ${id}:`, err.stack);
    if (err.code === '23505' && err.constraint === 'mesas_numero_mesa_key') {
      return res.status(409).json({ error: 'Ya existe otra mesa con ese número.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al actualizar la mesa', details: err.message });
  }
});

// DELETE: Eliminar una mesa por ID
app.delete('/api/mesas/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición DELETE recibida en /api/mesas/${id} desde ${req.ip}`);
  try {
    const { rows } = await db.query('DELETE FROM mesas WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) {
      console.warn(`WARN: /api/mesas/${id} (DELETE) - Mesa no encontrada para eliminar.`);
      return res.status(404).json({ error: 'Mesa no encontrada para eliminar' });
    }
    res.status(204).send();
    console.log(`INFO: /api/mesas/${id} (DELETE) - Mesa eliminada.`);
  } catch (err) {
    console.error(`ERROR al eliminar la mesa con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al eliminar la mesa', details: err.message });
  }
});


// --- Lógica de Socket.IO ---
console.log("INFO: Configurando Socket.IO...");
io.on('connection', (socket) => {
  console.log(`INFO: Cliente Socket.IO conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`INFO: Cliente Socket.IO desconectado: ${socket.id}`);
  });

  socket.on('mensajeDesdeCliente', (data) => {
    console.log(`INFO: Mensaje Socket.IO recibido de ${socket.id}:`, data);
    socket.emit('respuestaDesdeServidor', { reply: 'Mensaje recibido correctamente!' });
  });
});
console.log("INFO: Socket.IO configurado.");


// --- Iniciar el servidor ---
const PORT = process.env.PORT || 3001; // App Runner establece process.env.PORT
console.log(`INFO: Intentando iniciar servidor en el puerto ${PORT}...`);

server.listen(PORT, () => {
  console.log(`SUCCESS: Servidor backend corriendo en el puerto ${PORT}`);
  console.log(`INFO: Health check disponible en /api/health`);
  console.log(`INFO: DB test disponible en /api/db-test`);
});

// Manejo de errores no capturados (opcional pero buena práctica)
process.on('uncaughtException', (error) => {
  console.error('FATAL: Excepción no capturada:', error.stack || error);
  // Considera cerrar el servidor de forma elegante aquí y salir del proceso
  // process.exit(1); 
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Promesa rechazada no manejada:', reason.stack || reason);
  // Considera cerrar el servidor de forma elegante aquí y salir del proceso
  // process.exit(1);
});
