const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("DATABASE_URL:", process.env.DATABASE_URL);


const app = require("./app");
const prisma = require("./config/prismaClient");
const { initSocket } = require("./socket");

const port = process.env.PORT || 5050;

let server;

const startServer = async () => {
  try {
    // Créer les dossiers uploads s'ils n'existent pas
    const fs = require("fs");
    const path = require("path");
    const campaignsDir = path.join(__dirname, "../uploads/campaigns");
    const proofsDir = path.join(__dirname, "../uploads/vaccination-proofs");
    if (!fs.existsSync(campaignsDir)) {
      fs.mkdirSync(campaignsDir, { recursive: true });
      console.log("Campaigns uploads directory created");
    }
    if (!fs.existsSync(proofsDir)) {
      fs.mkdirSync(proofsDir, { recursive: true });
      console.log("Vaccination proofs uploads directory created");
    }

    await prisma.$connect();
    console.log("Database connected");

    server = app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });

    // Initialiser Socket.io
    initSocket(server);
    console.log("Socket.io initialized");

    // Démarrer le planificateur de tâches
  if (process.env.NODE_ENV !== "test" && process.env.DISABLE_CRON !== "true") {
    require("./jobs/scheduler");
  }
    console.log("Scheduler initialized");
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
};

const shutDown = async () => {
  console.log("Shutting down server...");
  await prisma.$disconnect();
  if (typeof prisma.$pool?.end === "function") {
    await prisma.$pool.end();
  }
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
};

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);

startServer();

