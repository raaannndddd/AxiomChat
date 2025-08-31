
// // livechat.js

// // ---- 0) Gate the page by login (REST cookie can stay here) ----
// (async () => {
//   try {
//     const res = await fetch('http://localhost:3000/check-login', {
//       credentials: 'include',
//     });
//     const data = await res.json();
//     if (!data?.loggedIn) {
//       window.location.href = '../login/login.html';
//     }
//   } catch (err) {
//     console.error('Login check failed:', err);
//     window.location.href = '../login/login.html'; // fallback
//   }
// })();

// // ---- 1) Main ----
// document.addEventListener('DOMContentLoaded', async () => {
//   console.log('✅ DOMContentLoaded fired');

//   // Ensure we're on axiom.trade (extension UX)
//   const isOnAxiom = await checkIfOnAxiom();
//   if (!isOnAxiom) {
//     document.body.innerHTML = `
//       <div style="padding: 20px; text-align: center;">
//         <h3>Please go to <a href="https://axiom.trade" target="_blank">axiom.trade</a> to use this extension.</h3>
//       </div>
//     `;
//     return;
//   }

//   // Elements
//   const msgerForm = get('.msger-inputarea');
//   const msgerInput = get('.msger-input');
//   const msgerChat = get('.msger-chat');
//   const statusEl = get('#status');
//   const coinInfoDiv = get('#coin-info');

//   if (!msgerForm || !msgerInput || !msgerChat) {
//     console.error('❌ Missing chat elements (.msger-inputarea / .msger-input / .msger-chat)');
//     return;
//   }

//   // ---- 2) Derive room from the active tab URL (robust) ----
//   const { pathname } = await getActiveTabPathname();
//   const currentRoom = deriveRoomFromUrlPath(pathname);
//   window.currentRoom = currentRoom;
//   console.log(`📦 Joining room: ${currentRoom}`);

//   // ---- 3) Resolve anonName (from server or fallback) ----
//   let anonName = 'Anon';
//   try {
//     const res = await fetch('http://localhost:3000/check-login', {
//       method: 'GET',
//       credentials: 'include',
//     });
//     const data = await res.json();
//     if (!data?.loggedIn) {
//       alert('Please log in first.');
//       window.location.href = 'http://localhost:3000/login/login.html';
//       return;
//     }
//     anonName =
//       data?.user?.anonName ||
//       localStorage.getItem('anonName') ||
//       `Anon${Math.floor(Math.random() * 9000) + 1000}`;
//   } catch (e) {
//     console.warn('⚠️ Falling back to local anonName:', e);
//     anonName = localStorage.getItem('anonName') || `Anon${Math.floor(Math.random() * 9000) + 1000}`;
//   }
//   localStorage.setItem('anonName', anonName);
//   if (statusEl) statusEl.innerText = `You are ${anonName}`;

//   // ---- 4) Load coin info for this room (best-effort) ----
//   if (coinInfoDiv && currentRoom) {
//     try {
//       const infoRes = await fetch(`http://localhost:3000/api/coin-info/${encodeURIComponent(currentRoom)}`);
//       const info = await infoRes.json();
//       if (info?.name) {
//         coinInfoDiv.innerHTML = `
//           <div><strong>🪙 ${String(info.name || '').toUpperCase()}</strong></div>
//           <div>🧠 Sentiment: <b>${escapeHtml(info.sentiment ?? 'N/A')}</b></div>
//           <div>💬 Tweets: ${Number(info.tweetCount ?? 0)}</div>
//           <div>🕓 Last Checked: ${info.updated ? new Date(info.updated).toLocaleString() : 'N/A'}</div>
//         `;
//       } else {
//         coinInfoDiv.innerHTML = `<div>❌ No sentiment info found.</div>`;
//       }
//     } catch (err) {
//       console.error('❌ Failed to load coin info:', err);
//       coinInfoDiv.innerHTML = `<div>⚠️ Failed to load sentiment data.</div>`;
//     }
//   }

//   // ---- 5) Initialize Socket.IO (stateless handshake; no cookies) ----
//   if (typeof io !== 'function') {
//     console.error('❌ socket.io-client not loaded. Include it before this script.');
//     return;
//   }

//   const socket = io('http://localhost:3000', {
//     transports: ['websocket'],
//     auth: { room: currentRoom, anonName },
//     // withCredentials: false  // we’re not relying on cookies for sockets
//   });

//   // ---- 6) Events ----
//   socket.on('connect', () => {
//     console.log('🟢 Socket connected:', socket.id);
//   });

//   socket.on('connected', (payload) => {
//     console.log('🔗 Joined server room:', payload);
//   });

//   socket.on('chat-history', (history) => {
//     if (Array.isArray(history)) {
//       history.forEach((d) => appendMessage(d?.user ?? 'Anon', d?.message ?? '', msgerChat));
//     }
//   });

//   socket.on('chat-message', (data) => {
//     appendMessage(data?.user ?? 'Anon', data?.message ?? '', msgerChat);
//   });

//   socket.on('rate-limit-warning', (msg) => {
//     appendMessage('System', msg ?? 'Rate limit warning', msgerChat);
//   });

//   socket.on('message-blocked', (msg) => {
//     appendMessage('System', msg ?? 'Message blocked', msgerChat);
//   });

//   socket.on('disconnect', (reason) => {
//     console.log('🔴 Socket disconnected:', reason);
//   });

//   // ---- 7) Send messages (moderation + rate limit) ----
//   const rateLimitWindow = 30_000; // 30s
//   const maxMsgsPerWindow = 5;
//   const sentTimestamps = [];

//   const blocklist = [
//     'kill', 'rape', 'bomb', 'shoot', 'dox', 'nazi', 'address', 'phone', 'ssn',
//     'threat', 'murder', 'swat', 'home', 'credit card', 'tracking number'
//   ];

//   msgerForm.addEventListener('submit', (e) => {
//     e.preventDefault();

//     const raw = msgerInput.value.trim();
//     const msgText = sanitize(raw);
//     if (!msgText) return;

//     // 🚫 Local blocklist moderation
//     if (isBlocked(msgText, blocklist)) {
//       appendMessage('System', '⚠️ Message contains blocked content and was not sent.', msgerChat);
//       msgerInput.value = '';
//       return;
//     }

//     // ⏳ Local rate limiting
//     const now = Date.now();
//     while (sentTimestamps.length && now - sentTimestamps[0] >= rateLimitWindow) {
//       sentTimestamps.shift();
//     }
//     if (sentTimestamps.length >= maxMsgsPerWindow) {
//       appendMessage('System', '⏱️ You’re sending messages too quickly. Try again soon.', msgerChat);
//       return;
//     }
//     sentTimestamps.push(now);

//     appendMessage(anonName, msgText, msgerChat);
//     socket.emit('send-chat-message', msgText);
//     msgerInput.value = '';
//   });

//   // ---- 8) Account button nav ----
//   document.getElementById('account-btn')?.addEventListener('click', async () => {
//     try {
//       const res = await fetch('http://localhost:3000/check-login', { credentials: 'include' });
//       const data = await res.json();
//       if (data?.loggedIn) {
//         window.location.href = '../login/account.html';
//       } else {
//         window.location.href = '../login/login.html';
//       }
//     } catch (err) {
//       console.error('Account check failed:', err);
//       window.location.href = '../login/login.html';
//     }
//   });

//   // ================== Helpers ==================

//   function isBlocked(msg, list) {
//     const lower = msg.toLowerCase();
//     return list.some((word) => lower.includes(word));
//   }

//   function sanitize(s) {
//     if (typeof DOMPurify !== 'undefined') {
//       return DOMPurify.sanitize(s, { SAFE_FOR_TEMPLATES: true });
//     }
//     // Minimal fallback: escape HTML (prevents markup injection)
//     return escapeHtml(s);
//   }

//   function escapeHtml(str) {
//     return String(str)
//       .replaceAll('&', '&amp;')
//       .replaceAll('<', '&lt;')
//       .replaceAll('>', '&gt;')
//       .replaceAll('"', '&quot;')
//       .replaceAll("'", '&#039;');
//   }

//   async function checkIfOnAxiom() {
//     return new Promise((resolve) => {
//       try {
//         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//           const url = tabs?.[0]?.url || '';
//           resolve(url.includes('axiom.trade'));
//         });
//       } catch {
//         resolve(false);
//       }
//     });
//   }

//   async function getActiveTabPathname() {
//     // Try content script first (most accurate if site does SPA routing)
//     const fromCS = await tryGetRoomFromContentScript();
//     if (fromCS?.pathname) return fromCS;

//     // Fallback to chrome.tabs
//     const fallback = await tryGetActiveTabUrl();
//     return { pathname: fallback?.pathname || '/' };
//   }

//   function deriveRoomFromUrlPath(pathname) {
//     const parts = String(pathname || '/').split('/').filter(Boolean);

//     // Prefer an address-like token (EVM or long slug)
//     const addr = parts.find((p) => /^0x[a-f0-9]{6,}$/i.test(p) || /^[A-Za-z0-9_-]{25,}$/.test(p));
//     if (addr) return addr;

//     // Otherwise, join the path for uniqueness; fallback to 'general'
//     return parts.length ? parts.join(':') : 'general';
//   }

//   function tryGetRoomFromContentScript() {
//     return new Promise((resolve) => {
//       try {
//         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//           const tabId = tabs?.[0]?.id;
//           if (!tabId) return resolve(null);
//           chrome.tabs.sendMessage(tabId, { type: 'get-url' }, (response) => {
//             // Handle no response / runtime errors
//             if (chrome.runtime.lastError) {
//               console.warn('Content script not responding:', chrome.runtime.lastError.message);
//               return resolve(null);
//             }
//             resolve(response || null);
//           });
//         });
//       } catch (e) {
//         console.warn('Failed to query content script url:', e);
//         resolve(null);
//       }
//     });
//   }

//   function tryGetActiveTabUrl() {
//     return new Promise((resolve) => {
//       try {
//         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//           const url = tabs?.[0]?.url || '';
//           try {
//             const u = new URL(url);
//             resolve({ href: url, pathname: u.pathname });
//           } catch {
//             resolve(null);
//           }
//         });
//       } catch (e) {
//         console.warn('Failed to get active tab url:', e);
//         resolve(null);
//       }
//     });
//   }

//   function appendMessage(name, text, container) {
//     const msg = document.createElement('div');
//     msg.className = 'msg';

//     const nameSpan = document.createElement('span');
//     nameSpan.className = 'user';
//     nameSpan.textContent = `${name}:`;

//     const textSpan = document.createElement('span');
//     textSpan.innerHTML = ` ${escapeHtml(String(text))}`;

//     msg.appendChild(nameSpan);
//     msg.appendChild(textSpan);

//     container.appendChild(msg);
//     container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
//   }

//   function get(selector, root = document) {
//     return root.querySelector(selector);
//   }
// });

// livechat.js

// ====== Configure this to a shared host if testing across machines ======
const BASE_URL = 'http://localhost:3000'; // e.g., 'http://192.168.1.50:3000'

// ---- 0) Gate the page by login (REST cookie can stay here) ----
(async () => {
  try {
    const res = await fetch(`${BASE_URL}/check-login`, { credentials: 'include' });
    const data = await res.json();
    if (!data?.loggedIn) window.location.href = '../login/login.html';
  } catch (err) {
    console.error('Login check failed:', err);
    window.location.href = '../login/login.html';
  }
})();

// ---- 1) Main ----
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOMContentLoaded fired');

  // Ensure we're on axiom.trade (extension UX)
  const isOnAxiom = await checkIfOnAxiom();
  if (!isOnAxiom) {
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h3>Please go to <a href="https://axiom.trade" target="_blank">axiom.trade</a> to use this extension.</h3>
      </div>
    `;
    return;
  }

  // Elements
  const msgerForm = get('.msger-inputarea');
  const msgerInput = get('.msger-input');
  const msgerChat  = get('.msger-chat');
  const statusEl   = get('#status');
  const coinInfoDiv = get('#coin-info');

  if (!msgerForm || !msgerInput || !msgerChat) {
    console.error('❌ Missing chat elements (.msger-inputarea / .msger-input / .msger-chat)');
    return;
  }

  // ---- 2) Derive a *normalized* room from the active tab URL ----
  const { pathname } = await getActiveTabPathname();
  const currentRoom = normalizeRoom(deriveRoomFromUrlPath(pathname));
  window.currentRoom = currentRoom;
  console.log('📦 Joining room:', currentRoom);

  // ---- 3) Resolve anonName (server or fallback) ----
  let anonName = 'Anon';
  try {
    const res = await fetch(`${BASE_URL}/check-login`, { method: 'GET', credentials: 'include' });
    const data = await res.json();
    if (!data?.loggedIn) {
      alert('Please log in first.');
      window.location.href = `${BASE_URL}/login/login.html`;
      return;
    }
    anonName = data?.user?.anonName ||
               localStorage.getItem('anonName') ||
               `Anon${Math.floor(Math.random() * 9000) + 1000}`;
  } catch (e) {
    console.warn('⚠️ Falling back to local anonName:', e);
    anonName = localStorage.getItem('anonName') || `Anon${Math.floor(Math.random() * 9000) + 1000}`;
  }
  localStorage.setItem('anonName', anonName);
  if (statusEl) statusEl.innerText = `You are ${anonName}`;

  // ---- 4) Load coin info (best effort) ----
  if (coinInfoDiv && currentRoom) {
    try {
      const infoRes = await fetch(`${BASE_URL}/api/coin-info/${encodeURIComponent(currentRoom)}`);
      const info = await infoRes.json();
      if (info?.name) {
        coinInfoDiv.innerHTML = `
          <div><strong>🪙 ${String(info.name || '').toUpperCase()}</strong></div>
          <div>🧠 Sentiment: <b>${escapeHtml(info.sentiment ?? 'N/A')}</b></div>
          <div>💬 Tweets: ${Number(info.tweetCount ?? 0)}</div>
          <div>🕓 Last Checked: ${info.updated ? new Date(info.updated).toLocaleString() : 'N/A'}</div>
        `;
      } else {
        coinInfoDiv.innerHTML = `<div>❌ No sentiment info found.</div>`;
      }
    } catch (err) {
      console.error('❌ Failed to load coin info:', err);
      coinInfoDiv.innerHTML = `<div>⚠️ Failed to load sentiment data.</div>`;
    }
  }

  // ---- 5) Initialize Socket.IO (stateless; no cookies) ----
  if (typeof io !== 'function') {
    console.error('❌ socket.io-client not loaded. Include it before this script.');
    return;
  }

  const socket = io(BASE_URL, {
    transports: ['websocket'],
    auth: { room: currentRoom, anonName },
  });

  // ---- 6) Wire events ----
  socket.on('connect', () => {
    console.log('🟢 Socket connected:', socket.id, 'room:', currentRoom, 'user:', anonName);
  });

  socket.on('connected', (payload) => {
    console.log('🔗 Server acknowledged join:', payload);
  });

  socket.on('chat-history', (history) => {
    if (Array.isArray(history)) {
      history.forEach((d) => appendMessage(d?.user ?? 'Anon', d?.message ?? '', msgerChat));
    }
  });

  socket.on('chat-message', (data) => {
    appendMessage(data?.user ?? 'Anon', data?.message ?? '', msgerChat);
  });

  socket.on('rate-limit-warning', (msg) => {
    appendMessage('System', msg ?? 'Rate limit warning', msgerChat);
  });

  socket.on('message-blocked', (msg) => {
    appendMessage('System', msg ?? 'Message blocked', msgerChat);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔴 Socket disconnected:', reason);
  });

  // ---- 7) Send with moderation + rate limit ----
  const rateLimitWindow = 30_000; // 30s
  const maxMsgsPerWindow = 5;
  const sentTimestamps = [];

  const blocklist = [
    'kill','rape','bomb','shoot','dox','nazi','address','phone','ssn',
    'threat','murder','swat','home','credit card','tracking number'
  ];

  msgerForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const raw = msgerInput.value.trim();
    const msgText = sanitize(raw);
    if (!msgText) return;

    if (isBlocked(msgText, blocklist)) {
      appendMessage('System', '⚠️ Message contains blocked content and was not sent.', msgerChat);
      msgerInput.value = '';
      return;
    }

    const now = Date.now();
    while (sentTimestamps.length && now - sentTimestamps[0] >= rateLimitWindow) sentTimestamps.shift();
    if (sentTimestamps.length >= maxMsgsPerWindow) {
      appendMessage('System', '⏱️ You’re sending messages too quickly. Try again soon.', msgerChat);
      return;
    }
    sentTimestamps.push(now);

    appendMessage(anonName, msgText, msgerChat);
    socket.emit('send-chat-message', msgText);
    msgerInput.value = '';
  });

  // ---- 8) Account button nav ----
  document.getElementById('account-btn')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${BASE_URL}/check-login`, { credentials: 'include' });
      const data = await res.json();
      window.location.href = data?.loggedIn ? '../login/account.html' : '../login/login.html';
    } catch (err) {
      console.error('Account check failed:', err);
      window.location.href = '../login/login.html';
    }
  });

  // ================== Helpers ==================
  function isBlocked(msg, list) {
    const lower = msg.toLowerCase();
    return list.some((w) => lower.includes(w));
  }

  function sanitize(s) {
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(s, { SAFE_FOR_TEMPLATES: true });
    return escapeHtml(s);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  async function checkIfOnAxiom() {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = tabs?.[0]?.url || '';
          resolve(url.includes('axiom.trade'));
        });
      } catch { resolve(false); }
    });
  }

  async function getActiveTabPathname() {
    const fromCS = await tryGetRoomFromContentScript();
    if (fromCS?.pathname) return fromCS;
    const fallback = await tryGetActiveTabUrl();
    return { pathname: fallback?.pathname || '/' };
  }

  function deriveRoomFromUrlPath(pathname) {
    const parts = String(pathname || '/').split('/').filter(Boolean);
    const addr = parts.find((p) => /^0x[a-f0-9]{6,}$/i.test(p) || /^[A-Za-z0-9_-]{25,}$/.test(p));
    if (addr) return addr;
    return parts.length ? parts.join(':') : 'general';
  }

  function normalizeRoom(room) {
    return String(room || 'general').trim().toLowerCase();
  }

  function tryGetRoomFromContentScript() {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tabId = tabs?.[0]?.id;
          if (!tabId) return resolve(null);
          chrome.tabs.sendMessage(tabId, { type: 'get-url' }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Content script not responding:', chrome.runtime.lastError.message);
              return resolve(null);
            }
            resolve(response || null);
          });
        });
      } catch (e) {
        console.warn('Failed to query content script url:', e);
        resolve(null);
      }
    });
  }

  function tryGetActiveTabUrl() {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = tabs?.[0]?.url || '';
          try {
            const u = new URL(url);
            resolve({ href: url, pathname: u.pathname });
          } catch { resolve(null); }
        });
      } catch (e) {
        console.warn('Failed to get active tab url:', e);
        resolve(null);
      }
    });
  }

  function appendMessage(name, text, container) {
    const msg = document.createElement('div');
    msg.className = 'msg';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'user';
    nameSpan.textContent = `${name}:`;

    const textSpan = document.createElement('span');
    textSpan.innerHTML = ` ${escapeHtml(String(text))}`;

    msg.appendChild(nameSpan);
    msg.appendChild(textSpan);

    container.appendChild(msg);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }

  function get(selector, root = document) {
    return root.querySelector(selector);
  }
});