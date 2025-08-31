chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "LOGIN_SUCCESS") {
      console.log("✅ User logged in!");
      // Optionally update extension UI or store login flag
    }
  });