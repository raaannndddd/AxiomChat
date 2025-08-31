document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
  
      if (!email || !password) {
        alert("Please fill in both fields.");
        return;
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

      if(!passwordRegex.test(password)){
        alert("Password must be 8 characters, have at least 1 special character, 1 uppercase letter, 1 lowercase letter, and 1 number.");
        return
      }
  
      try {
        const response = await fetch("http://localhost:3000/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // important for cookies in Chrome Extension
          body: JSON.stringify({ email, password }),
        });
  
        const data = await response.json();
  
        if (data.success) {
          alert("✅ Registered and logged in!");
          window.location.href = "../livechat/livechat.html";
        } else {
          alert("❌ " + (data.error || "Registration failed"));
        }
      } catch (err) {
        console.error("❌ Registration error:", err);
        alert("An unexpected error occurred.");
      }
    });
  });
  