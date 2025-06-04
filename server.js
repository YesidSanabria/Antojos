// server.js (Raíz del proyecto)
console.log(`LOG INICIO APP: server.js ejecutándose a las ${new Date().toISOString()}`);
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  console.log("INFO: Cargando variables de entorno desde .env (desarrollo local)");
  // Asegúrate que la ruta a .env sea correcta si no está en la raíz con server.js
  // Si server.js está en la raíz del proyecto, y .env también, esto está bien.
  require('dotenv').config();
} else {
  console.log("INFO: Entorno de producción detectado, no se carga .env");
}

console.log("--- VARIABLES DE ENTORNO RECIBIDAS ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT (variable de entorno cruda):", process.env.PORT);
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "DATABASE_URL está presente" : "DATABASE_URL NO está presente");
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("------------------------------------");

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

console.log("INFO: Importando módulo de base de datos (db/database.js)...");
const db = require('./db/database'); // Asume que db/database.js está en la misma raíz
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
  console.log(`HEALTH CHECK: Petición GET recibida en /api/health a las ${new Date().toISOString()} desde ${req.ip}`);
  try {
    res.status(200).json({ status: "UP", message: "El servidor backend está saludable y esta ruta fue alcanzada!" });
    console.log("HEALTH CHECK: /api/health respondió 200 OK");
  } catch (e) {
    console.error("HEALTH CHECK ERROR en /api/health:", e.stack);
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

// --- CRUD para Productos (sin imagen_url) ---
console.log("INFO: Configurando rutas CRUD para productos...");
// CREATE: Añadir un nuevo producto
app.post('/api/productos', async (req, res) => {
  console.log(`INFO: Petición POST recibida en /api/productos desde ${req.ip} con body:`, req.body);
  const { nombre, descripcion, precio, categoria, disponible, stock_quantity } = req.body;
  if (!nombre || precio === undefined) {
    console.warn("WARN: /api/productos (POST) - Faltan campos obligatorios (nombre o precio)");
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
    console.log("INFO: /api/productos (POST) - Producto creado:", rows[0].id);
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
    console.log(`INFO: /api/productos (GET) - Se devolvieron ${rows.length} productos.`);
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
      console.warn(`WARN: /api/productos/${id} (GET) - Producto no encontrado.`);
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/productos/${id} (GET) - Producto encontrado y devuelto.`);
  } catch (err) {
    console.error(`ERROR al obtener el producto con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener el producto', details: err.message });
  }
});

// UPDATE: Actualizar un producto existente por ID
app.put('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición PUT recibida en /api/productos/${id} desde ${req.ip} con body:`, req.body);
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
console.log("INFO: Rutas CRUD para productos configuradas.");

// --- CRUD para Mesas ---
console.log("INFO: Configurando rutas CRUD para mesas...");
// CREATE: Añadir una nueva mesa
app.post('/api/mesas', async (req, res) => {
  console.log(`INFO: Petición POST recibida en /api/mesas desde ${req.ip} con body:`, req.body);
  const { numero_mesa, descripcion, activa } = req.body;

  if (numero_mesa === undefined || numero_mesa === null) {
    console.warn("WARN: /api/mesas (POST) - Falta numero_mesa");
    return res.status(400).json({ error: 'El campo numero_mesa es obligatorio.' });
  }
  if (isNaN(parseInt(numero_mesa))) {
    console.warn("WARN: /api/mesas (POST) - numero_mesa no es un número");
    return res.status(400).json({ error: 'El campo numero_mesa debe ser un número.' });
  }

  try {
    const queryText = `
      INSERT INTO mesas (numero_mesa, descripcion, activa) 
      VALUES ($1, $2, $3) 
      RETURNING *;
    `;
    const values = [
      parseInt(numero_mesa),
      descripcion,
      activa === undefined ? true : activa
    ];
    
    const { rows } = await db.query(queryText, values);
    res.status(201).json(rows[0]);
    console.log("INFO: /api/mesas (POST) - Mesa creada:", rows[0].id);
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
    console.log(`INFO: /api/mesas (GET) - Se devolvieron ${rows.length} mesas.`);
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
      console.warn(`WARN: /api/mesas/${id} (GET) - Mesa no encontrada.`);
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/mesas/${id} (GET) - Mesa encontrada y devuelta.`);
  } catch (err) {
    console.error(`ERROR al obtener la mesa con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener la mesa', details: err.message });
  }
});

// UPDATE: Actualizar una mesa existente por ID
app.put('/api/mesas/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición PUT recibida en /api/mesas/${id} desde ${req.ip} con body:`, req.body);
  const { numero_mesa, descripcion, activa } = req.body;

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
        activa = $3
        -- Si NO tiene el trigger 'set_timestamp_mesas', añade: , updated_at = CURRENT_TIMESTAMP 
      WHERE id = $4 
      RETURNING *;
    `;
    const values = [
        parseInt(numero_mesa), 
        descripcion, 
        activa === undefined ? true : activa, // Default a true si no se especifica para 'activa'
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
console.log("INFO: Rutas CRUD para mesas configuradas.");

// --- CRUD para Pedidos ---
console.log("INFO: Configurando rutas CRUD para pedidos...");

// CREATE: Registrar un nuevo pedido
app.post('/api/pedidos', async (req, res) => {
  const { mesa_id, notas_cliente, items } = req.body;
  console.log(`INFO: Petición POST recibida en /api/pedidos desde ${req.ip} con body:`, req.body);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El pedido debe contener al menos un item.' });
  }

  // Validar cada item
  for (const item of items) {
    if (!item.producto_id || !item.cantidad || parseInt(item.cantidad) <= 0) {
      return res.status(400).json({ error: 'Cada item debe tener un producto_id y una cantidad válida (mayor a 0).' });
    }
  }

  const client = await db.getPool().connect(); // Obtener un cliente del pool para la transacción

  try {
    await client.query('BEGIN'); // Iniciar transacción

    // 1. Insertar en la tabla 'pedidos'
    const pedidoQueryText = `
      INSERT INTO pedidos (mesa_id, estado, notas_cliente) 
      VALUES ($1, $2, $3) 
      RETURNING id, estado, created_at;
    `;
    // Estado inicial 'pendiente'
    const pedidoValues = [mesa_id ? parseInt(mesa_id) : null, 'pendiente', notas_cliente];
    const pedidoResult = await client.query(pedidoQueryText, pedidoValues);
    const nuevoPedidoId = pedidoResult.rows[0].id;
    let totalPedidoCalculado = 0;

    console.log(`INFO: Pedido base creado con ID: ${nuevoPedidoId}`);

    // 2. Insertar cada item en 'items_pedido'
    const itemsInsertados = [];
    for (const item of items) {
      // Obtener el precio actual del producto
      const productoResult = await client.query('SELECT precio, nombre FROM productos WHERE id = $1 AND disponible = TRUE', [item.producto_id]);
      if (productoResult.rows.length === 0) {
        throw new Error(`Producto con ID ${item.producto_id} no encontrado o no disponible.`);
      }
      const precioUnitario = parseFloat(productoResult.rows[0].precio);
      const nombreProducto = productoResult.rows[0].nombre; // Para la respuesta
      const cantidad = parseInt(item.cantidad);
      const subtotal = cantidad * precioUnitario;
      totalPedidoCalculado += subtotal;

      const itemQueryText = `
        INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario_en_pedido, subtotal, notas_item)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const itemValues = [nuevoPedidoId, item.producto_id, cantidad, precioUnitario, subtotal, item.notas_item];
      const itemResult = await client.query(itemQueryText, itemValues);
      itemsInsertados.push({
          ...itemResult.rows[0],
          nombre_producto: nombreProducto // Añadir nombre para la respuesta
      });
      console.log(`INFO: Item insertado para pedido ID ${nuevoPedidoId}: producto ID ${item.producto_id}, cantidad ${cantidad}`);
    }

    // 3. (Opcional pero recomendado) Actualizar el total_pedido en la tabla 'pedidos'
    await client.query('UPDATE pedidos SET total_pedido = $1 WHERE id = $2', [totalPedidoCalculado, nuevoPedidoId]);
    console.log(`INFO: Total del pedido ID ${nuevoPedidoId} actualizado a: ${totalPedidoCalculado}`);

    await client.query('COMMIT'); // Confirmar transacción

    // (Más adelante) Emitir evento Socket.IO
    // io.emit('nuevo_pedido_cocina', { ...pedidoResult.rows[0], id: nuevoPedidoId, total_pedido: totalPedidoCalculado, items: itemsInsertados });

    res.status(201).json({ 
        ...pedidoResult.rows[0], 
        id: nuevoPedidoId, 
        mesa_id: mesa_id ? parseInt(mesa_id) : null,
        notas_cliente: notas_cliente,
        total_pedido: totalPedidoCalculado, 
        items: itemsInsertados 
    });

  } catch (err) {
    await client.query('ROLLBACK'); // Revertir transacción en caso de error
    console.error("ERROR al crear el pedido (transacción revertida):", err.stack);
    res.status(500).json({ error: 'Error interno del servidor al crear el pedido', details: err.message });
  } finally {
    client.release(); // Liberar el cliente de vuelta al pool
    console.log("INFO: Cliente de base de datos liberado.");
  }
});

// READ: Obtener todos los pedidos (con sus items y detalles de productos)
app.get('/api/pedidos', async (req, res) => {
  console.log(`INFO: Petición GET recibida en /api/pedidos desde ${req.ip}`);
  try {
    // Esta consulta es más compleja para traer los datos relacionados
    const queryText = `
      SELECT 
        p.id as pedido_id, 
        p.mesa_id, 
        m.numero_mesa,
        p.estado, 
        p.total_pedido,
        p.notas_cliente,
        p.created_at as pedido_creado_en,
        json_agg(
          json_build_object(
            'item_id', ip.id,
            'producto_id', ip.producto_id,
            'nombre_producto', prod.nombre,
            'cantidad', ip.cantidad,
            'precio_unitario_en_pedido', ip.precio_unitario_en_pedido,
            'subtotal', ip.subtotal,
            'notas_item', ip.notas_item
          ) ORDER BY prod.nombre ASC
        ) FILTER (WHERE ip.id IS NOT NULL) as items -- Usar FILTER para manejar pedidos sin items (aunque no debería pasar con la lógica de creación)
      FROM pedidos p
      LEFT JOIN mesas m ON p.mesa_id = m.id
      LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
      LEFT JOIN productos prod ON ip.producto_id = prod.id
      GROUP BY p.id, m.numero_mesa
      ORDER BY p.created_at DESC;
    `;
    const { rows } = await db.query(queryText);
    res.status(200).json(rows);
    console.log(`INFO: /api/pedidos (GET) - Se devolvieron ${rows.length} pedidos.`);
  } catch (err) {
    console.error("ERROR al obtener los pedidos:", err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener los pedidos', details: err.message });
  }
});

// READ: Obtener un pedido específico por ID (con sus items y detalles de productos)
app.get('/api/pedidos/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`INFO: Petición GET recibida en /api/pedidos/${id} desde ${req.ip}`);
  try {
    const queryText = `
      SELECT 
        p.id as pedido_id, 
        p.mesa_id, 
        m.numero_mesa,
        p.estado, 
        p.total_pedido,
        p.notas_cliente,
        p.created_at as pedido_creado_en,
        p.updated_at as pedido_actualizado_en,
        json_agg(
          json_build_object(
            'item_id', ip.id,
            'producto_id', ip.producto_id,
            'nombre_producto', prod.nombre,
            'descripcion_producto', prod.descripcion,
            'categoria_producto', prod.categoria,
            'cantidad', ip.cantidad,
            'precio_unitario_en_pedido', ip.precio_unitario_en_pedido,
            'subtotal', ip.subtotal,
            'notas_item', ip.notas_item
          ) ORDER BY prod.nombre ASC
        ) FILTER (WHERE ip.id IS NOT NULL) as items
      FROM pedidos p
      LEFT JOIN mesas m ON p.mesa_id = m.id
      LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
      LEFT JOIN productos prod ON ip.producto_id = prod.id
      WHERE p.id = $1
      GROUP BY p.id, m.numero_mesa;
    `;
    const { rows } = await db.query(queryText, [id]);
    if (rows.length === 0) {
      console.warn(`WARN: /api/pedidos/${id} (GET) - Pedido no encontrado.`);
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/pedidos/${id} (GET) - Pedido encontrado y devuelto.`);
  } catch (err) {
    console.error(`ERROR al obtener el pedido con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al obtener el pedido', details: err.message });
  }
});

// UPDATE: Actualizar el estado de un pedido por ID
app.put('/api/pedidos/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  console.log(`INFO: Petición PUT recibida en /api/pedidos/${id}/estado desde ${req.ip} con body:`, req.body);

  if (!estado) {
    return res.status(400).json({ error: 'El campo estado es obligatorio.' });
  }
  // Podrías añadir validación para asegurar que 'estado' sea uno de los valores permitidos

  try {
    // Si tienes el trigger para 'updated_at' en la tabla 'pedidos', no necesitas incluirlo aquí.
    // Si no, añade: ", updated_at = CURRENT_TIMESTAMP"
    const queryText = `
      UPDATE pedidos 
      SET estado = $1 
      WHERE id = $2 
      RETURNING *;
    `;
    const { rows } = await db.query(queryText, [estado, id]);
    
    if (rows.length === 0) {
      console.warn(`WARN: /api/pedidos/${id}/estado (PUT) - Pedido no encontrado para actualizar estado.`);
      return res.status(404).json({ error: 'Pedido no encontrado para actualizar estado' });
    }

    // (Más adelante) Emitir evento Socket.IO
    // io.emit('actualizacion_estado_pedido', rows[0]);
    
    res.status(200).json(rows[0]);
    console.log(`INFO: /api/pedidos/${id}/estado (PUT) - Estado del pedido actualizado a: ${estado}`);
  } catch (err) {
    console.error(`ERROR al actualizar estado del pedido con ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Error interno del servidor al actualizar estado del pedido', details: err.message });
  }
});

console.log("INFO: Rutas CRUD para pedidos configuradas.");

// --- Lógica de Socket.IO ---
console.log("INFO: Configurando Socket.IO...");
io.on('connection', (socket) => {
  console.log(`INFO: Cliente Socket.IO conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`INFO: Cliente Socket.IO desconectado: ${socket.id}`);
  });

  socket.on('mensajeDesdeCliente', (data) => {
    console.log(`INFO: Mensaje Socket.IO recibido de ${socket.id}:`, JSON.stringify(data));
    socket.emit('respuestaDesdeServidor', { reply: 'Mensaje recibido correctamente por el servidor!' });
  });
});
console.log("INFO: Socket.IO configurado.");


// --- Iniciar el servidor ---
const PORT_APP = process.env.PORT || 3001; // App Runner establece process.env.PORT
console.log(`INFO: Variable PORT de entorno es: ${process.env.PORT}. Usando puerto: ${PORT_APP}`);

server.listen(PORT_APP, () => {
  console.log(`SUCCESS: Servidor backend corriendo en el puerto ${PORT_APP}`);
  console.log(`INFO: Health check disponible en /api/health`);
  console.log(`INFO: DB test disponible en /api/db-test`);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error, origin) => {
  console.error(`FATAL: Excepción no capturada en ${origin}:`, error.stack || error);
  // En un entorno de producción real, podrías querer cerrar el servidor de forma elegante
  // y permitir que el orquestador de contenedores (como App Runner) reinicie el servicio.
  // process.exit(1); 
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Promesa rechazada no manejada en:', promise, 'razón:', reason.stack || reason);
  // process.exit(1);
});
