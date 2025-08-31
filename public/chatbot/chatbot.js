const form = document.getElementById('chatForm');
const input = document.getElementById('userInput');
const chatLog = document.getElementById('chatLog');
const CHAT_STORAGE_KEY = 'aiChatHistory';

let aiChatMessages = [];
let currentRoom = null;
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { type: "get-url" }, (response) => {
    if (response?.pathname) {
      const parts = response.pathname.split("/");
      currentRoom = parts[2] || "general";
    }
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  aiChatMessages = await new Promise(resolve => 
    chrome.storage.local.get([CHAT_STORAGE_KEY], result => resolve(result[CHAT_STORAGE_KEY] || []))
  );
  aiChatMessages.forEach(({ user, text }) => appendMessage(user, text));
});

document.getElementById('monitor-btn').addEventListener('click', async () => {
  if (!currentRoom) return alert("No coin selected");
  const res = await fetch(`http://localhost:3000/api/monitor/${currentRoom}`, {
    method: "POST",
    credentials: "include"
  });
  const data = await res.json();
  alert(data.message);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = DOMPurify.sanitize(input.value.trim());
  if (!message) return;

  input.value = '';
  addAndSaveMessage("You", message);

  try {
    const coinId = currentRoom || "general"; // Use current room as coinId
    const response = await fetch('http://localhost:3000/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: message, coinId })  // <-- FIX
    });

    const data_raw = await response.json();
    const data = DOMPurify.sanitize(data_raw.result);
    addAndSaveMessage("Bot", data);
  } catch (err) {
    console.error(err);
    addAndSaveMessage("Bot", "Something went wrong.");
  }
});

function addAndSaveMessage(user, text) {
  aiChatMessages.push({ user, text });
  appendMessage(user, text);
  chrome.storage.local.set({ [CHAT_STORAGE_KEY]: aiChatMessages });
}

function appendMessage(name, text) {
  const msg = document.createElement("div");
  msg.className = "msg";

  const nameSpan = document.createElement("span");
  nameSpan.className = "user";
  nameSpan.textContent = name + ":";

  const textSpan = document.createElement("span");
  textSpan.textContent = " " + text;

  msg.appendChild(nameSpan);
  msg.appendChild(textSpan);
  chatLog.appendChild(msg);

  // Ensure DOM has rendered before scrolling
  chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: "auto" });
}