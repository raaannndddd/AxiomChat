(async () => {
  try {
    const res = await fetch('http://localhost:3000/check-login', {
      credentials: 'include',
    });
    const data = await res.json();

    if (!data.loggedIn) {
      window.location.href = '../login/login.html';
    }
  } catch (err) {
    console.error("Login check failed:", err);
    window.location.href = '../login/login.html'; // fallback
  }
})();

document.addEventListener("DOMContentLoaded", async () => {
  const isOnAxiom = await checkIfOnAxiom();

  if (!isOnAxiom) {
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h3>Please go to <a href="https://axiom.trade" target="_blank">axiom.trade</a> to use this extension.</h3>
      </div>
    `;
    return;
  }

  // 🔍 Coin info detection from URL
const coinInfoDiv = document.getElementById("coin-info");

  console.log("✅ DOMContentLoaded fired");

  const msgerForm = get(".msger-inputarea");
  const msgerInput = get(".msger-input");
  const msgerChat = get(".msger-chat");

  let socket = null;
  let anonName = null;
  let currentRoom = null;

  const rateLimitWindow = 30000; // 30s window
  const maxMsgsPerWindow = 5;
  let sentTimestamps = [];

  const blocklist = [
    "kill", "rape", "bomb", "shoot", "dox", "nazi", "address", "phone", "ssn",
    "threat", "murder", "swat", "home", "credit card", "tracking number"
  ];

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "get-url" }, async (response) => {
      if (!response || !response.pathname) {
        console.error("❌ Failed to get room path from content script");
        return;
      }

      const roomParts = response.pathname.split("/");
      currentRoom = roomParts[2] || "general";
      window.currentRoom = currentRoom;
      console.log(`📦 Joining room: ${currentRoom}`);

      const res = await fetch("http://localhost:3000/check-login", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();
      if (!data.loggedIn) {
        alert("Please log in first.");
        window.location.href = "http://localhost:3000/login/login.html";
        return;
      }

      anonName = data.user.anonName;
      const status = document.getElementById("status");
      if (status) status.innerText = `You are ${anonName}`;

      // ⬇️ Put this immediately after currentRoom is defined
const coinInfoDiv = document.getElementById("coin-info");
if (coinInfoDiv && currentRoom) {
  try {
    const infoRes = await fetch(`http://localhost:3000/api/coin-info/${currentRoom}`);
    const info = await infoRes.json();

    if (info?.name) {
      coinInfoDiv.innerHTML = `
        <div><strong>🪙 ${info.name.toUpperCase()}</strong></div>
        <div>🧠 Sentiment: <b>${info.sentiment}</b></div>
        <div>💬 Tweets: ${info.tweetCount}</div>
        <div>🕓 Last Checked: ${new Date(info.updated).toLocaleString()}</div>
      `;
    } else {
      coinInfoDiv.innerHTML = `<div>❌ No sentiment info found.</div>`;
    }
  } catch (err) {
    console.error("❌ Failed to load coin info:", err);
    coinInfoDiv.innerHTML = `<div>⚠️ Failed to load sentiment data.</div>`;
  }
}


      socket = io("http://localhost:3000", {
        withCredentials: true,
      });

      socket.on("connect", () => {
        console.log("🟢 Socket connected");

        socket.emit("join-room", currentRoom);
        socket.emit("new-user", anonName);

        socket.on("chat-history", (history) => {
          history.forEach((data) => {
            appendMessage(data.user, data.message);
          });
        });

        socket.on("chat-message", (data) => {
          appendMessage(data.user, data.message);
        });

        socket.on("rate-limit-warning", (msg) => {
          appendMessage("System", msg);
        });

        socket.on("message-blocked", (msg) => {
          appendMessage("System", msg);
        });
      });

      msgerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const msgText_dirty = msgerInput.value.trim();
        const msgText = DOMPurify.sanitize(msgText_dirty, { SAFE_FOR_TEMPLATES: true });
        if (!msgText) return;

        // 🚫 Local blocklist moderation
        if (isBlocked(msgText)) {
          appendMessage("System", "⚠️ Message contains blocked content and was not sent.");
          msgerInput.value = "";
          return;
        }

        // ⏳ Local rate limiting
        const now = Date.now();
        sentTimestamps = sentTimestamps.filter(t => now - t < rateLimitWindow);
        if (sentTimestamps.length >= maxMsgsPerWindow) {
          appendMessage("System", "⏱️ You're sending messages too quickly. Try again soon.");
          return;
        }

        sentTimestamps.push(now);

        appendMessage(`${anonName}`, msgText);
        socket.emit("send-chat-message", msgText);

        msgerInput.value = "";
      });
    });
  });

  document.getElementById('account-btn')?.addEventListener('click', async () => {
    try {
      const res = await fetch('http://localhost:3000/check-login', {
        credentials: 'include'
      });
      const data = await res.json();

      if (data.loggedIn) {
        window.location.href = '../login/account.html';
      } else {
        window.location.href = '../login/login.html';
      }
    } catch (err) {
      console.error("Account check failed:", err);
      window.location.href = '/login/login.html';
    }
  });

  // --- Helpers ---
  function isBlocked(msg) {
    const lower = msg.toLowerCase();
    return blocklist.some(word => lower.includes(word));
  }

  async function checkIfOnAxiom() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs?.[0]?.url || "";
        const allowedHost = "axiom.trade";
        resolve(url.includes(allowedHost));
      });
    });
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

    msgerChat.appendChild(msg);
    msgerChat.scrollTo({ top: msgerChat.scrollHeight, behavior: "smooth" });
  }

  function get(selector, root = document) {
    return root.querySelector(selector);
  }
});
