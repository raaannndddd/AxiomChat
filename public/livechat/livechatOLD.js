// document.addEventListener("DOMContentLoaded", () => {
//   console.log("✅ DOMContentLoaded fired");

//   const msgerForm = get(".msger-inputarea");
//   const msgerInput = get(".msger-input");
//   const msgerChat = get(".msger-chat");

//   // Connect socket *after DOM is ready*
//   const socket = io("http://localhost:3000"); // Replace with prod if needed
//   socket.on("connect", () => {
//     checkLoginAndJoinRoom(socket);
//   });

//   // Ask content script for current pathname (room)
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     chrome.tabs.sendMessage(tabs[0].id, { type: "get-url" }, (response) => {
//       if (!response || !response.pathname) {
//         console.error("❌ Failed to get room path from content script");
//         return;
//       }

//       const roomParts = response.pathname.split("/");
//       const room = roomParts[2] || "general";
//       // const user_dirty = prompt("What is your name?") || "Anonymous";
//       const user = DOMPurify.sanitize(user_dirty, { SAFE_FOR_TEMPLATES: true });

//       console.log(`🧑 Username: ${user}`);
//       console.log(`📦 Room: ${room}`);

//       socket.emit("join-room", room);
//       // socket.emit("new-user", user);

//       socket.on("chat-history", (history) => {
//         history.forEach((data) => {
//           appendMessage(data.user, data.message);
//         });
//       });

//       socket.on("chat-message", (data) => {
//         appendMessage(data.user, data.message);
//       });

//       socket.on("user-connected", (name) => {
//         appendMessage("System", `${name} connected`);
//       });

//       msgerForm.addEventListener("submit", (e) => {
//         e.preventDefault();
//         const msgText_dirty = msgerInput.value.trim();
//         const msgText = DOMPurify.sanitize(msgText_dirty, { SAFE_FOR_TEMPLATES: true });
//         if (!msgText) return;

//         appendMessage(anonName, msgText);
//         socket.emit("send-chat-message", msgText);
//         msgerInput.value = "";
//       });
//     });
//   });

//   // async function checkLoginAndJoinRoom(socket, room = "default") {
//   //   // 1. Check if logged in
//   //   const res = await fetch("http://localhost:3000/check-login", {
//   //     credentials: "include",
//   //   });
//   //   const data = await res.json();
  
//   //   if (!data.loggedIn) {
//   //     alert("Please log in first.");
//   //     window.location.href = "http://localhost:3000/login/login.html";
//   //     return;
//   //   }
  
//   //   // 2. Join room
//   //   socket.emit("join-room", room);
  
//   //   // 3. Request anonymous name from server
//   //   socket.emit("new-user", null, (anonName) => {
//   //     console.log("✅ You are", anonName);
//   //     document.getElementById("status").innerText = `You are ${anonName}`;
//   //   });
//   // }

//   // async function checkLoginAndJoinRoom(socket, room = "default") {
//   //   const res = await fetch("http://localhost:3000/check-login", {
//   //     method = "GET",
//   //     credentials: "include",
//   //   });
//   //   const data = await res.json();
  
//   //   if (!data.loggedIn) {
//   //     alert("Please log in first.");
//   //     window.location.href = "http://localhost:3000/login/login.html";
//   //     return;
//   //   }

//   // Move anonName to outer scope
//   let anonName = null;
// async function checkLoginAndJoinRoom(socket, room = "default") {
//   const res = await fetch("http://localhost:3000/check-login", {
//     method: "GET", // ✅ Use colon not equal
//     credentials: "include",
//   });
//   const data = await res.json();

//   if (!data.loggedIn) {
//     alert("Please log in first.");
//     window.location.href = "http://localhost:3000/login/login.html";
//     return;
//   }

//   anonName = data.user.anonName;

//   // Join room
//   socket.emit("join-room", room);

//   // Register user on server
//   socket.emit("new-user", anonName);

//   // UI feedback
//   const status = document.getElementById("status");
//   if (status) status.innerText = `You are ${anonName}`;
// }
  
//   //   const anonName = data.user.anonName;
  
//   //   // Join room
//   //   socket.emit("join-room", room);
  
//   //   // Register with server using persistent anonName
//   //   socket.emit("new-user", anonName);
  
//   //   // UI feedback
//   //   document.getElementById("status").innerText = `You are ${anonName}`;
//   // }

//   function appendMessage(name, text) {
//     const safeName = name || "❓Unknown";
//     const msg = document.createElement("div");
//     msg.className = "msg";
  
//     const nameSpan = document.createElement("span");
//     nameSpan.className = "user";
//     nameSpan.textContent = safeName + ":";
  
//     const textSpan = document.createElement("span");
//     textSpan.textContent = " " + text;
  
//     msg.appendChild(nameSpan);
//     msg.appendChild(textSpan);
  
//     const chat = document.querySelector(".msger-chat");
//     chat.appendChild(msg);
//     chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
//   }  
// });

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOMContentLoaded fired");

  const msgerForm = get(".msger-inputarea");
  const msgerInput = get(".msger-input");
  const msgerChat = get(".msger-chat");
  let socket = null;
  let anonName = null;
  let currentRoom = null;

  // Ask content script for current pathname (room)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "get-url" }, async (response) => {
      if (!response || !response.pathname) {
        console.error("❌ Failed to get room path from content script");
        return;
      }

      const roomParts = response.pathname.split("/");
      currentRoom = roomParts[2] || "general";
      console.log(`📦 Room: ${currentRoom}`);

      // Connect socket AFTER getting room and login info
      socket = io("http://localhost:3000", {
        withCredentials: true
      });

      socket.on("connect", async () => {
        await checkLoginAndJoinRoom(socket, currentRoom);

        socket.on("chat-history", (history) => {
          history.forEach((data) => {
            appendMessage(data.user, data.message);
          });
        });

        socket.on("chat-message", (data) => {
          appendMessage(data.user, data.message);
        });

        socket.on("user-connected", (name) => {
          appendMessage("System", `${name} connected`);
        });
      });

      msgerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const msgText_dirty = msgerInput.value.trim();
        const msgText = DOMPurify.sanitize(msgText_dirty, { SAFE_FOR_TEMPLATES: true });
        if (!msgText) return;

        appendMessage(anonName, msgText);
        socket.emit("send-chat-message", msgText);
        msgerInput.value = "";
      });
    });
  });

  async function checkLoginAndJoinRoom(socket, room) {
    try {
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
      console.log("✅ Logged in as:", anonName);

      socket.emit("join-room", room);
      socket.emit("new-user", anonName);

      const status = document.getElementById("status");
      if (status) status.innerText = `You are ${anonName}`;
    } catch (err) {
      console.error("❌ Login check failed:", err);
      alert("Failed to verify login.");
    }
  }

  function appendMessage(name, text) {
    const safeName = name || "❓Unknown";
    const msg = document.createElement("div");
    msg.className = "msg";

    const nameSpan = document.createElement("span");
    nameSpan.className = "user";
    nameSpan.textContent = safeName + ":";

    const textSpan = document.createElement("span");
    textSpan.textContent = " " + text;

    msg.appendChild(nameSpan);
    msg.appendChild(textSpan);

    const chat = document.querySelector(".msger-chat");
    chat.appendChild(msg);
    chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  }

  function get(selector, root = document) {
    return root.querySelector(selector);
  }
});