const { Server } = require("socket.io");

let io;

/**
 * Initialise Socket.io avec le serveur HTTP
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        // Autoriser toutes les origines en développement
        if (process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }
        // En production, liste stricte
        const allowedOrigins = [
          "http://localhost:3000",
          "http://localhost:3001",
        ];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`✅ Client connecté: ${socket.id}`);

    // Gérer les rooms
    socket.on("join", (data) => {
      if (data && data.room) {
        socket.join(data.room);
        console.log(`✅ Client ${socket.id} a rejoint la room: ${data.room}`);
      }
    });

    socket.on("leave", (data) => {
      if (data && data.room) {
        socket.leave(data.room);
        console.log(`❌ Client ${socket.id} a quitté la room: ${data.room}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client déconnecté: ${socket.id}`);
    });

    socket.on("error", (error) => {
      console.error(`❌ Erreur Socket.io: ${error}`);
    });
  });

  return io;
};

/**
 * Envoyer une notification à une room spécifique
 */
const sendNotification = (room, notification) => {
  if (io) {
    io.to(room).emit("newNotification", notification);
    console.log(`📩 Notification envoyée à la room: ${room}`);
  }
};

/**
 * Envoyer une notification à un parent spécifique
 */
const sendNotificationToParent = (parentPhone, notification) => {
  if (io) {
    io.to("parent").emit("newNotification", notification);
    console.log(`📩 Notification envoyée au parent: ${parentPhone}`);
  }
};

/**
 * Envoyer une notification à un enfant spécifique
 */
const sendNotificationToChild = (childId, notification) => {
  if (io) {
    // Compter le nombre de sockets dans la room
    const room = io.sockets.adapter.rooms.get(childId);
    const socketCount = room ? room.size : 0;
    console.log(`📩 Envoi notification à la room "${childId}" (${socketCount} client(s) connecté(s))`);
    
    io.to(childId).emit("newNotification", notification);
    console.log(`📩 Notification envoyée à l'enfant: ${childId}`);
    console.log(`📩 Données envoyées:`, JSON.stringify(notification, null, 2));
  } else {
    console.error("❌ Socket.io n'est pas initialisé");
  }
};

/**
 * Envoyer une notification à tous les clients
 */
const sendNotificationToAll = (notification) => {
  if (io) {
    const socketCount = io.sockets.sockets.size;
    console.log(`📩 Envoi notification à tous les clients (${socketCount} client(s) connecté(s))`);
    io.emit("newNotification", notification);
    console.log(`📩 Notification envoyée à tous les clients`);
    console.log(`📩 Données envoyées:`, JSON.stringify(notification, null, 2));
  } else {
    console.error("❌ Socket.io n'est pas initialisé");
  }
};

module.exports = {
  initSocket,
  sendNotification,
  sendNotificationToParent,
  sendNotificationToChild,
  sendNotificationToAll,
  getIO: () => io,
};

