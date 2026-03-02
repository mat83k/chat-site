const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.IO (same origin, pas besoin de config CORS spéciale ici)
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ---------- FRONT (public/) ----------
const publicDir = path.join(__dirname, "public");

// Sert tous les fichiers statiques (index.html, css, js, etc.)
app.use(express.static(publicDir));

// Route d'accueil "béton" (évite le fameux "Cannot GET /")
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Optionnel: petit endpoint pour vérifier que le serveur répond
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// ---------- CHAT (mémoire RAM) ----------
const history = []; // { username, msg, ts }
const HISTORY_LIMIT = 50;

const usersBySocket = new Map(); // socket.id -> { username }

function sanitizeText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

io.on("connection", (socket) => {
  // envoie l'historique au nouvel arrivant
  socket.emit("history", history);

  socket.on("join", (rawUsername) => {
    const username = sanitizeText(rawUsername, 24) || "Anonyme";
    usersBySocket.set(socket.id, { username });

    socket.broadcast.emit("system", `${username} a rejoint le chat`);
    io.emit("onlineCount", usersBySocket.size);
  });

  socket.on("chatMessage", (rawMsg) => {
    const msg = sanitizeText(rawMsg, 500);
    if (!msg) return;

    const username = usersBySocket.get(socket.id)?.username || "Anonyme";

    const payload = {
      username,
      msg,
      ts: Date.now()
    };

    history.push(payload);
    if (history.length > HISTORY_LIMIT) history.shift();

    io.emit("chatMessage", payload);
  });

  socket.on("typing", (isTyping) => {
    const username = usersBySocket.get(socket.id)?.username;
    if (!username) return;
    socket.broadcast.emit("typing", { username, isTyping: !!isTyping });
  });

  socket.on("disconnect", () => {
    const username = usersBySocket.get(socket.id)?.username;
    if (username) {
      usersBySocket.delete(socket.id);
      socket.broadcast.emit("system", `${username} a quitté le chat`);
    }
    io.emit("onlineCount", usersBySocket.size);
  });
});

server.listen(PORT, () => {
  console.log(`Chat en ligne: http://localhost:${PORT}`);
});