const socket = io();

const roomsEl = document.getElementById("rooms");
const usersEl = document.getElementById("users");

const messagesEl = document.getElementById("messages");
const typingEl = document.getElementById("typing");
const errorEl = document.getElementById("error");

const roomNameEl = document.getElementById("roomName");
const roomCountEl = document.getElementById("roomCount");
const statusEl = document.getElementById("status");

const usernameEl = document.getElementById("username");
const joinBtn = document.getElementById("joinBtn");

const formEl = document.getElementById("form");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");

let joined = false;
let currentRoom = "general";
let currentUser = null;

const typingUsers = new Set();
let typingTimeout = null;

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setError(text) {
  errorEl.textContent = text || "";
}

function setJoinedState(isJoined) {
  joined = isJoined;
  inputEl.disabled = !isJoined;
  sendBtn.disabled = !isJoined;
  usernameEl.disabled = isJoined;
  joinBtn.disabled = isJoined;
  statusEl.textContent = isJoined ? "connecté" : "déconnecté";
  if (isJoined) inputEl.focus();
}

function clearMessages() {
  messagesEl.innerHTML = "";
  typingEl.textContent = "";
  typingUsers.clear();
}

function addSystem(text) {
  const div = document.createElement("div");
  div.className = "system";
  div.innerHTML = escapeHtml(text);
  messagesEl.appendChild(div);
  scrollToBottom();
}

function addMessage({ username, msg, ts }) {
  const box = document.createElement("div");
  box.className = "msg";
  box.innerHTML = `
    <div class="meta">
      <span class="name">${escapeHtml(username)}</span>
      <span class="time">${escapeHtml(formatTime(ts))}</span>
    </div>
    <div class="text">${escapeHtml(msg)}</div>
  `;
  messagesEl.appendChild(box);
  scrollToBottom();
}

function renderRooms(rooms) {
  roomsEl.innerHTML = "";
  for (const r of rooms) {
    const btn = document.createElement("button");
    btn.className = "roomBtn" + (r.name === currentRoom ? " active" : "");
    btn.type = "button";
    btn.innerHTML = `
      <div class="roomLeft">
        <div class="hashSmall">#</div>
        <div>${escapeHtml(r.name)}</div>
      </div>
      <div class="badge">${escapeHtml(String(r.count ?? 0))}</div>
    `;
    btn.addEventListener("click", () => {
      if (!joined) {
        currentRoom = r.name;
        roomNameEl.textContent = currentRoom;
        renderRooms(rooms);
        return;
      }
      socket.emit("switchRoom", r.name);
    });
    roomsEl.appendChild(btn);
  }
}

function renderUsers(users) {
  usersEl.innerHTML = "";
  for (const u of users) {
    const pill = document.createElement("div");
    pill.className = "userPill";
    pill.textContent = u;
    usersEl.appendChild(pill);
  }
}

function renderTyping() {
  if (typingUsers.size === 0) {
    typingEl.textContent = "";
    return;
  }
  const names = [...typingUsers].slice(0, 3);
  const more = typingUsers.size > 3 ? ` +${typingUsers.size - 3}` : "";
  typingEl.textContent = `${names.join(", ")}${more} écrit...`;
}

// ---------- UI events ----------
joinBtn.addEventListener("click", () => {
  setError("");
  const username = (usernameEl.value || "").trim();
  if (!username || username.length < 2) {
    setError("Pseudo invalide (min 2 caractères).");
    return;
  }
  socket.emit("join", { username, room: currentRoom });
});

usernameEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!joined) return;

  const text = (inputEl.value || "").trim();
  if (!text) return;

  socket.emit("chatMessage", text);
  inputEl.value = "";
  socket.emit("typing", false);
});

inputEl.addEventListener("input", () => {
  if (!joined) return;

  socket.emit("typing", true);

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("typing", false), 800);
});

// ---------- Socket events ----------
socket.on("connect", () => {
  statusEl.textContent = joined ? "connecté" : "déconnecté";
});

socket.on("roomsMeta", (rooms) => {
  // rooms = [{name,count}]
  renderRooms(rooms || []);
});

socket.on("joinError", (msg) => {
  setError(msg || "Impossible de rejoindre.");
  setJoinedState(false);
});

socket.on("joined", ({ username, room }) => {
  currentUser = username;
  currentRoom = room;
  roomNameEl.textContent = currentRoom;
  setJoinedState(true);
  clearMessages();
  setError("");
});

socket.on("history", ({ room, items }) => {
  if (room !== currentRoom) return;
  clearMessages();
  for (const it of items || []) addMessage(it);
  scrollToBottom();
});

socket.on("chatMessage", (payload) => {
  if (payload?.room && payload.room !== currentRoom) return;
  addMessage(payload);
});

socket.on("system", ({ room, text }) => {
  if (room && room !== currentRoom) return;
  addSystem(text);
});

socket.on("roomUsers", ({ room, users }) => {
  if (room !== currentRoom) return;
  renderUsers(users || []);
});

socket.on("roomCount", ({ room, count }) => {
  if (room !== currentRoom) return;
  roomCountEl.textContent = String(count ?? 0);
});

socket.on("typing", ({ room, username, isTyping }) => {
  if (room !== currentRoom) return;
  if (!username) return;

  if (isTyping) typingUsers.add(username);
  else typingUsers.delete(username);

  // évite de s’afficher soi-même si jamais
  if (currentUser) typingUsers.delete(currentUser);

  renderTyping();
});