require("dotenv").config();

const express = require("express");
const prisma = require("./config/prismaClient");
const routes = require("./routes");
const prismaMiddleware = require("./middleware/prisma");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.locals.prisma = prisma;

const cors = require("cors");

// Configuration CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // En développement, autoriser toutes les origines localhost
    if (process.env.NODE_ENV !== "production") {
      // Autoriser localhost avec n'importe quel port
      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.startsWith("http://192.168.") || // Pour les tests sur réseau local
        origin.startsWith("http://10.0.") // Pour les tests sur réseau local
      ) {
        return callback(null, true);
      }
    }
    
    // En production, liste stricte des origines autorisées
    const allowedOrigins = [
      "http://localhost:3001",
      "http://localhost:3000",
      // Ajouter ici les domaines de production
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(prismaMiddleware);

// Servir les fichiers statiques depuis le dossier uploads
const path = require("path");
// Servir d'abord depuis frontend/public/uploads (pour les logos du superadmin)
app.use("/uploads", express.static(path.join(__dirname, "../frontend/public/uploads")));
// Puis depuis uploads à la racine (pour les autres fichiers)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", routes);

app.use(errorHandler);

module.exports = app;

