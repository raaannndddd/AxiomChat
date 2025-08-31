document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch('http://localhost:3000/check-login', {
        credentials: 'include'
      });
      const data = await res.json();
  
      if (!data.loggedIn) {
        window.location.href = 'login.html';
        return;
      }
      const infoDiv = document.getElementById("account-info");
      infoDiv.textContent = `Logged in as ${data.user.email || data.user.wallet || data.user.anonName}`;
    } catch (err) {
      console.error("Failed to load account:", err);
      window.location.href = 'login.html';
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      const res = await fetch('http://localhost:3000/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });      
      const data = await res.json();
      if (data.success) {
        window.location.href = 'login.html';
      } else {
        alert("Logout failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  });  