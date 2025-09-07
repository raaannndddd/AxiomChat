// document.addEventListener("DOMContentLoaded", () => {
//     const form = document.getElementById("registerForm");
//     const emailInput = document.getElementById("email");
//     const passwordInput = document.getElementById("password");
  
//     form.addEventListener("submit", async (e) => {
//       e.preventDefault();
  
//       const email = emailInput.value.trim();
//       const password = passwordInput.value.trim();
  
//       if (!email || !password) {
//         alert("Please fill in both fields.");
//         return;
//       }

//       const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

//       if(!passwordRegex.test(password)){
//         alert("Password must be 8 characters, have at least 1 special character, 1 uppercase letter, 1 lowercase letter, and 1 number.");
//         return
//       }
  
//       try {
//         const response = await fetch("http://localhost:3000/auth/register", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           credentials: "include", // important for cookies in Chrome Extension
//           body: JSON.stringify({ email, password }),
//         });
  
//         const data = await response.json();
  
//         if (data.success) {
//           alert("✅ Registered and logged in!");
//           window.location.href = "../livechat/livechat.html";
//         } else {
//           alert("❌ " + (data.error || "Registration failed"));
//         }
//       } catch (err) {
//         console.error("❌ Registration error:", err);
//         alert("An unexpected error occurred.");
//       }
//     });
//   });
  
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const anonNameInput = document.getElementById("anonName"); // optional field

  // Use same-origin in the browser; explicit localhost for Chrome extension
  const API_BASE = (location.protocol === "chrome-extension:")
    ? "http://localhost:3000"
    : ""; // same-origin

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  async function jsonOrText(res) {
    const txt = await res.text().catch(() => "");
    try { return { data: JSON.parse(txt), text: txt }; }
    catch { return { data: null, text: txt }; }
  }

  async function guestLoginFallback() {
    try {
      const r = await fetch(`${API_BASE}/auth/guest`, {
        method: "POST",
        credentials: "include",
      });
      const { data, text } = await jsonOrText(r);
      if (r.ok && data?.ok) {
        alert(`🟢 Logged in as guest: ${data.user?.anonName || "Anon"}`);
        window.location.href = "/livechat/livechat.html";
        return true;
      } else {
        console.warn("Guest login failed:", data || text);
      }
    } catch (e) {
      console.error("Guest login network error:", e);
    }
    return false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const anonName = anonNameInput ? anonNameInput.value.trim() : undefined;

    if (!email || !password) {
      alert("Please fill in both fields.");
      return;
    }

    if (!passwordRegex.test(password)) {
      alert("Password must be 8+ chars and include 1 uppercase, 1 lowercase, 1 number, and 1 special character.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // IMPORTANT for session cookies
        body: JSON.stringify({ email, password, anonName }),
      });

      const { data, text } = await jsonOrText(res);

      // Server (our no-DB version) returns { ok: true, user: {...} } or { ok: true, guest: true, user: {...} }
      if (res.ok && (data?.ok || data?.success)) {
        if (data?.guest) {
          alert(`⚠️ Registration unavailable — continuing as guest: ${data.user?.anonName || "Anon"}`);
        } else {
          alert(`✅ Registered & logged in as ${data?.user?.email || email}`);
        }
        window.location.href = "/livechat/livechat.html";
        return;
      }

      // Non-OK or unexpected payload → guest fallback
      console.warn("Registration failed:", data || text || res.statusText);
      const guestOk = await guestLoginFallback();
      if (!guestOk) alert(`❌ ${data?.error || "Registration failed and guest login failed."}`);
    } catch (err) {
      console.error("❌ Registration fetch error:", err);
      const guestOk = await guestLoginFallback();
      if (!guestOk) alert("❌ Network error and guest login failed.");
    }
  });
});