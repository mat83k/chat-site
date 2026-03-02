const socket = io();

const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("form");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");

const usernameEl = document.getElementById("username");
const joinBtn = document.getElementById("joinBtn");
const onlineCountEl = document.getElementById("onlineCount");
const typingEl = document.getElementById("typing");

let joined = false;
let typingTimeout = null;
const typingUsers = new Set();

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

function setJoinedState(isJoined) {
  joined = isJoined;
  inputEl.disabled = !isJoined;
  sendBtn.disabled = !isJoined;
  usernameEl.disabled = isJoined;
  joinBtn.disabled = isJoined;
  if (isJoined) inputEl.focus();
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

joinBtn.addEventListener("click", () => {
  const username = usernameEl.value.trim() || "Anonyme";
  socket.emit("join", username);
  setJoinedState(true);
});

usernameEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!joined) return;

  const text = inputEl.value.trim();
  if (!text) return;

  socket.emit("chatMessage", text);
  inputEl.value = "";
  socket.emit("typing", false);
});

inputEl.addEventListener("input", () => {
  if (!joined) return;

  socket.emit("typing", true);

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("typing", false);
  }, 800);
});

// --- Socket events ---
socket.on("history", (items) => {
  messagesEl.innerHTML = "";
  for (const it of items) addMessage(it);
  scrollToBottom();
});

socket.on("chatMessage", (payload) => {
  addMessage(payload);
});

socket.on("system", (text) => {
  addSystem(text);
});

socket.on("onlineCount", (n) => {
  onlineCountEl.textContent = String(n);
});

socket.on("typing", ({ username, isTyping }) => {
  if (!username) return;
  if (isTyping) typingUsers.add(username);
  else typingUsers.delete(username);
  renderTyping();
});