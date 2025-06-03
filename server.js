require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const db = require('./db/database');
const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST"]
};

const io = new Server(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rutas de API ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "UP", message: "El servidor backend está saludable!" });
});

// GET: Obtener todos los productos
app.get('/api/productos', async (req, res) => {
  try {
    console.error("Error al obtener productos:", err.stack)
    const { rows } = await db.query('SELECT * FROM productos ORDER BY nombre ASC');
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error al obtener productos:", err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener productos', details: err.message });
  }
});

// GET: Obtener un producto por ID
app.get('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(`Error al obtener el producto con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener el producto', details: err.message });
  }
});

// POST: Crear un nuevo producto
app.post('/api/productos', async (req, res) => {
  const { nombre, descripcion, precio, categoria, disponible, stock_quantity } = req.body;

  // Validación básica de campos requeridos
  if (!nombre || precio === undefined) {
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
  } catch (err) {
    console.error("Error al crear el producto:", err.stack);
    // Manejar error de unicidad para 'nombre'
    if (err.code === '23505' && err.constraint === 'productos_nombre_key') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al crear el producto', details: err.message });
  }
});

// PUT: Actualizar un producto existente por ID
app.put('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio, categoria, disponible, stock_quantity } = req.body;

  if (!nombre || precio === undefined) {
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
      WHERE id = $8 
      RETURNING *;
    `;
    const values = [
        nombre, 
        descripcion, 
        parseFloat(precio), 
        categoria, 
        disponible,  
        parseInt(stock_quantity), 
        id
    ];
    
    const { rows } = await db.query(queryText, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado para actualizar' });
    }
    res.status(200).json(rows[0]); // Devuelve el producto actualizado
  } catch (err) {
    console.error(`Error al actualizar el producto con ID ${id}:`, err.stack);
    if (err.code === '23505' && err.constraint === 'productos_nombre_key') {
      return res.status(409).json({ error: 'Ya existe otro producto con ese nombre.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al actualizar el producto', details: err.message });
  }
});

// DELETE: Eliminar un producto por ID
app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('DELETE FROM productos WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado para eliminar' });
    }
    // res.status(200).json({ message: 'Producto eliminado exitosamente', producto: rows[0] });
    res.status(204).send();
  } catch (err) {
    console.error(`Error al eliminar el producto con ID ${id}:`, err.stack);
    if (err.code === '23503') { // Código de error para violación de foreign key
        return res.status(409).json({ error: 'No se puede eliminar el producto porque está referenciado en pedidos existentes.', constraint: err.constraint });
    }
    res.status(500).json({ error: 'Error interno del servidor al eliminar el producto', details: err.message });
  }
});



app.get('/api/db-test', async (req, res) => {
  try {
    const result = await db.query('SELECT $1::text as message', ['¡Conexión a BD exitosa desde la API!']);
    if (result && result.rows && result.rows.length > 0) {
      res.status(200).json({ dbMessage: result.rows[0].message });
    } else {
      console.warn("Advertencia en /api/db-test: La consulta a la BD fue exitosa pero no devolvió filas o el formato es inesperado.");
      res.status(200).json({ dbMessage: "Consulta a BD aparentemente exitosa, pero sin mensaje de retorno esperado." });
    }
  } catch (err) {
    console.error("Error crítico en la ruta /api/db-test:", err.stack);
    res.status(500).json({ error: 'Error al conectar o consultar la base de datos', details: err.message });
  }
});

// --- Lógica de Socket.IO ---
io.on('connection', (socket) => {
  console.log(`Un cliente se ha conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });

  socket.on('mensajeDesdeCliente', (data) => {
    console.log(`Mensaje recibido de ${socket.id}:`, data);
    socket.emit('respuestaDesdeServidor', { reply: 'Mensaje recibido correctamente!' });
  });
});

// --- Iniciar el servidor ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});