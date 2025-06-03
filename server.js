require('dotenv').config(); // Asegúrate que la ruta a .env sea correcta si no está en la raíz con server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const db = require('./db/database'); // <-- IMPORTANTE

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173", // O el puerto de tu frontend en Netlify
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