const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// Petite mémoire en RAM (dernier historique)
const history = [];
const HISTORY_LIMIT = 50;

// Liste des gens connectés
const usersBySocket = new Map(); // socket.id -> { username }

function sanitizeText(str) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, 500);
}

io.on("connection", (socket) => {
  socket.emit("history", history);

  socket.on("join", (rawUsername) => {
    const username = sanitizeText(rawUsername) || "Anonyme";
    usersBySocket.set(socket.id, { username });

    socket.broadcast.emit("system", `${username} a rejoint le chat`);
    io.emit("onlineCount", usersBySocket.size);
  });

  socket.on("chatMessage", (rawMsg) => {
    const msg = sanitizeText(rawMsg);
    if (!msg) return;

    const user = usersBySocket.get(socket.id);
    const username = user?.username || "Anonyme";

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
    const user = usersBySocket.get(socket.id);
    if (!user) return;
    socket.broadcast.emit("typing", { username: user.username, isTyping: !!isTyping });
  });

  socket.on("disconnect", () => {
    const user = usersBySocket.get(socket.id);
    if (user) {
      usersBySocket.delete(socket.id);
      socket.broadcast.emit("system", `${user.username} a quitté le chat`);
    }
    io.emit("onlineCount", usersBySocket.size);
  });
});

server.listen(PORT, () => {
  console.log(`Chat en ligne: http://localhost:${PORT}`);
});