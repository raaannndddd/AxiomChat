const BACKEND_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    // const phantomBtn = document.getElementById('phantom-login');
    const googleBtn = document.getElementById('google-login');
    const statusDiv = document.getElementById('status');
  
    const updateStatus = (msg) => {
      statusDiv.textContent = msg;
    };

    document.getElementById("google-login").addEventListener("click", () => {
      chrome.tabs.create({ url: "http://localhost:3000/auth/google" });
    });
  
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email.value;
      const password = loginForm.password.value;
  
      try {
        const res = await fetch(`${BACKEND_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
  
        const data = await res.json();
        if (data.success) {
          window.location.href = '../livechat/livechat.html';
        } else {
          updateStatus(data.error || 'Login failed');
        }
      } catch (err) {
        updateStatus('Error logging in.');
        console.error(err);
      }
    });
  
    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = registerForm.email.value;
      const password = registerForm.password.value;
  
      try {
        const res = await fetch(`${BACKEND_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
  
        const data = await res.json();
        if (data.success) {
          updateStatus('Registered! Now log in.');
        } else {
          updateStatus(data.error || 'Registration failed');
        }
      } catch (err) {
        updateStatus('Error registering.');
        console.error(err);
      }
    });
  
    googleBtn?.addEventListener('click', () => {
        chrome.tabs.create({ url: "http://localhost:3000/auth/google" });
    });
  
    // phantomBtn?.addEventListener('click', async () => {
    //   if (!window.solana || !window.solana.isPhantom) {
    //     return updateStatus('Phantom wallet not found. Please install it.');
    //   }
  
    //   try {
    //     const resp = await window.solana.connect();
    //     const wallet = resp.publicKey.toString();
  
    //     const res = await fetch('/auth/phantom', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({ wallet })
    //     });
  
    //     const data = await res.json();
    //     if (data.success) {
    //       window.location.href = '../livechat/livechat.html';
    //     } else {
    //       updateStatus(data.error || 'Phantom login failed');
    //     }
    //   } catch (err) {
    //     updateStatus('Error logging in with Phantom');
    //     console.error(err);
    //   }
    // });

    const logoutBtn = document.getElementById("logout-btn");

logoutBtn?.addEventListener("click", async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      updateStatus("Logged out successfully.");
      // Optional: Redirect to login page or clear UI
      window.location.href = '/login/login.html';
    } else {
      updateStatus(data.error || 'Logout failed');
    }
  } catch (err) {
    updateStatus("Error during logout");
    console.error(err);
  }
});
  });