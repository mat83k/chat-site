const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ---------- Front ----------
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/health", (req, res) => res.status(200).send("ok"));

// ---------- Chat (mémoire RAM) ----------
const DEFAULT_ROOMS = ["general", "gaming", "dev", "random"];

const state = {
  // room -> [{ username, msg, ts, id }]
  historyByRoom: new Map(DEFAULT_ROOMS.map((r) => [r, []])),
  // room -> Map(socketId -> username)
  usersByRoom: new Map(DEFAULT_ROOMS.map((r) => [r, new Map()])),
};

const HISTORY_LIMIT = 80;

function sanitizeText(v, maxLen) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

function isValidRoom(room) {
  return state.historyByRoom.has(room);
}

function listUsers(room) {
  const m = state.usersByRoom.get(room);
  if (!m) return [];
  return [...m.values()].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

function pushHistory(room, payload) {
  const arr = state.historyByRoom.get(room);
  if (!arr) return;
  arr.push(payload);
  if (arr.length > HISTORY_LIMIT) arr.shift();
}

function emitRoomState(room) {
  io.to(room).emit("roomUsers", { room, users: listUsers(room) });
  io.to(room).emit("roomCount", { room, count: listUsers(room).length });
}

function emitRoomsMeta() {
  const rooms = [...state.historyByRoom.keys()].map((r) => ({
    name: r,
    count: listUsers(r).length,
  }));
  io.emit("roomsMeta", rooms);
}

io.on("connection", (socket) => {
  socket.data.username = null;
  socket.data.room = null;

  // Envoie la liste des rooms au client
  socket.emit("roomsMeta", [...state.historyByRoom.keys()].map((r) => ({
    name: r,
    count: listUsers(r).length,
  })));

  socket.on("join", (raw) => {
    const username = sanitizeText(raw?.username, 24);
    const room = sanitizeText(raw?.room, 24) || "general";

    if (!username || username.length < 2) {
      socket.emit("joinError", "Pseudo invalide (min 2 caractères).");
      return;
    }
    if (!isValidRoom(room)) {
      socket.emit("joinError", "Salon introuvable.");
      return;
    }

    // Quitte l'ancien salon si besoin
    if (socket.data.room) {
      const prev = socket.data.room;
      socket.leave(prev);
      const prevUsers = state.usersByRoom.get(prev);
      if (prevUsers) prevUsers.delete(socket.id);
      io.to(prev).emit("system", { room: prev, text: `${socket.data.username} a quitté #${prev}` });
      emitRoomState(prev);
    }

    socket.data.username = username;
    socket.data.room = room;

    socket.join(room);
    state.usersByRoom.get(room).set(socket.id, username);

    // Confirme au client
    socket.emit("joined", { username, room });

    // Envoie l'historique du salon
    socket.emit("history", {
      room,
      items: state.historyByRoom.get(room),
    });

    // System message salon
    socket.to(room).emit("system", { room, text: `${username} a rejoint #${room}` });

    emitRoomState(room);
    emitRoomsMeta();
  });

  socket.on("switchRoom", (rawRoom) => {
    const room = sanitizeText(rawRoom, 24);
    if (!socket.data.username) return;
    socket.emit("join", { username: socket.data.username, room });
  });

  socket.on("chatMessage", (rawMsg) => {
    if (!socket.data.username || !socket.data.room) return;

    const msgRaw = sanitizeText(rawMsg, 500);
    if (!msgRaw) return;

    // Commandes
    if (msgRaw.startsWith("/nick ")) {
      const newNick = sanitizeText(msgRaw.slice(6), 24);
      if (!newNick || newNick.length < 2) {
        socket.emit("system", { room: socket.data.room, text: "Pseudo invalide (min 2 caractères)." });
        return;
      }
      const old = socket.data.username;
      socket.data.username = newNick;

      const room = socket.data.room;
      const users = state.usersByRoom.get(room);
      if (users) users.set(socket.id, newNick);

      io.to(room).emit("system", { room, text: `${old} s'appelle maintenant ${newNick}` });
      emitRoomState(room);
      emitRoomsMeta();
      return;
    }

    const room = socket.data.room;
    const payload = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      username: socket.data.username,
      msg: msgRaw,
      ts: Date.now(),
    };

    pushHistory(room, payload);
    io.to(room).emit("chatMessage", payload);
  });

  socket.on("typing", (isTyping) => {
    if (!socket.data.username || !socket.data.room) return;
    socket.to(socket.data.room).emit("typing", {
      room: socket.data.room,
      username: socket.data.username,
      isTyping: !!isTyping,
    });
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    const username = socket.data.username;
    if (room && username && state.usersByRoom.get(room)) {
      state.usersByRoom.get(room).delete(socket.id);
      socket.to(room).emit("system", { room, text: `${username} s'est déconnecté` });
      emitRoomState(room);
      emitRoomsMeta();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Chat en ligne: http://localhost:${PORT}`);
});