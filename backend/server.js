require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST"]
};

const io = new Server(server, {
  cors: corsOptions
});

const PORT = process.env.PORT || 3001;


app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rutas de API (Ejemplo) ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "UP", message: "El servidor backend está saludable!" });
});

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
server.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});