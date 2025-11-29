const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const { initializeBotManager } = require('./utils/whatsapp');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Initialisation du gestionnaire de bots
const botManager = initializeBotManager(io);

// Stockage global pour l'accès aux routes
global.botManager = botManager;

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
  console.log('Utilisateur connecté:', socket.id);

  socket.on('join-dashboard', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`Utilisateur ${userId} a rejoint son dashboard`);
  });

  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Crazy-mini démarré sur le port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});
