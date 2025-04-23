document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("username") || "Guest";
  const room = params.get("room") || "Lobby";

  document.getElementById("roomName").textContent = room;
  const socket = io();

  const messagesDiv = document.getElementById("messages");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const typingIndicator = document.getElementById("typingIndicator");
  const typingUsersElement = document.getElementById("typingUsers");
  const onlineUsersDesktop = document.getElementById("onlineUsersDesktop");
  const onlineUsersMobile = document.getElementById("onlineUsersMobile");
  const mobileMenuButton = document.getElementById("mobileMenuButton");
  const closeMobileMenu = document.getElementById("closeMobileMenu");
  const mobileUsersMenu = document.getElementById("mobileUsersMenu");
  const logoutBtn = document.getElementById("logoutBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const imageUpload = document.getElementById("imageUpload");
  const onlineCount = document.getElementById("onlineCount");
  const mobileOnlineCount = document.getElementById("mobileOnlineCount");
  const aiHelpBtn = document.getElementById("aiHelpBtn");
  const aiPromptButton = document.getElementById("aiPromptButton");
  const aiHelpModal = document.getElementById("aiHelpModal");
  const closeAiHelpModal = document.getElementById("closeAiHelpModal");
  const gotItButton = document.getElementById("gotItButton");

  //sound button
  // —— 1) grab your DOM nodes once ——
  const soundToggleBtn = document.getElementById("soundToggleBtn");
  const notificationSoundToggle = document.getElementById(
    "notificationSoundToggle"
  );
  const soundVolumeSlider = document.getElementById("soundVolume");
  const soundSelect = document.getElementById("soundSelect");
  const notificationAudio = document.getElementById("notificationSound");
  const testSoundBtn = document.getElementById("testSoundBtn");
  const saveSoundSettingsBtn = document.getElementById("saveSoundSettingsBtn");
  const soundSettingsModal = document.getElementById("soundSettingsModal");
  const closeSoundSettingsBtn = document.getElementById(
    "closeSoundSettingsModal"
  );

  // —— 2) define your sound files & state ——
  const soundOptions = {
    default: "/sound/default.mp3",
    chime: "/sound/chime.mp3",
    bell: "/sound/bell.mp3",
    pop: "/sound/pop.mp3",
  };
  let soundSettings = { enabled: true, volume: 0.5, sound: "default" };

  // —— 3) implement load/save/icon/play ——
  function loadSoundSettings() {
    const saved = localStorage.getItem("neonChatSoundSettings");
    if (saved) Object.assign(soundSettings, JSON.parse(saved));
    notificationSoundToggle.checked = soundSettings.enabled;
    soundVolumeSlider.value = soundSettings.volume;
    soundSelect.value = soundSettings.sound;
    notificationAudio.volume = soundSettings.volume;
    updateSoundToggleIcon();
  }

  function saveSoundSettings() {
    localStorage.setItem(
      "neonChatSoundSettings",
      JSON.stringify(soundSettings)
    );
  }

  function updateSoundToggleIcon() {
    const icon = soundToggleBtn.querySelector("i");
    icon.classList.toggle("fa-volume-up", soundSettings.enabled);
    icon.classList.toggle("fa-volume-mute", !soundSettings.enabled);
  }

  function playNotificationSound() {
    if (!soundSettings.enabled) return;

    // Play sound
    notificationAudio.src = soundOptions[soundSettings.sound];
    notificationAudio.volume = soundSettings.volume;
    notificationAudio.play().catch(console.error);

    // Also vibrate if on mobile (optional)
    if ("vibrate" in navigator) {
      navigator.vibrate(200);
    }
  }

  // Enhanced showNotification function with fallback
  function showNotification(title, options) {
    // If Notifications API is supported and permission is granted
    if ("Notification" in window && Notification.permission === "granted") {
      if (!document.hasFocus()) {
        try {
          new Notification(title, options);
          playNotificationSound();
          return;
        } catch (error) {
          console.error("Notification API error:", error);
          // Fall through to fallback
        }
      }
    }

    // Fallback for browsers without Notification support or when tab is focused
    const fallback = document.getElementById("fallbackNotification");
    if (fallback) {
      document.getElementById("fallbackNotificationTitle").textContent = title;
      document.getElementById("fallbackNotificationBody").textContent =
        options.body || "";

      fallback.classList.remove("hidden");
      playNotificationSound();

      // Auto-hide after 5 seconds
      setTimeout(() => {
        fallback.classList.add("hidden");
      }, 5000);
    }
  }

  // —— 4) wire up your event listeners ——
  // Toggle mute/unmute icon & state
  soundToggleBtn.addEventListener("click", () => {
    soundSettings.enabled = !soundSettings.enabled;
    notificationSoundToggle.checked = soundSettings.enabled;
    updateSoundToggleIcon();
    saveSoundSettings();
  });

  // Live‐sync the checkbox in the modal
  notificationSoundToggle.addEventListener("change", () => {
    soundSettings.enabled = notificationSoundToggle.checked;
    updateSoundToggleIcon();
    saveSoundSettings();
  });

  // Volume slider
  soundVolumeSlider.addEventListener("input", () => {
    soundSettings.volume = parseFloat(soundVolumeSlider.value);
    notificationAudio.volume = soundSettings.volume;
    saveSoundSettings();
  });

  // Effect selector
  soundSelect.addEventListener("change", () => {
    soundSettings.sound = soundSelect.value;
    saveSoundSettings();
  });

  // Test button
  testSoundBtn.addEventListener("click", playNotificationSound);

  // Save button in modal
  saveSoundSettingsBtn.addEventListener("click", () => {
    saveSoundSettings();
    soundSettingsModal.classList.add("hidden");
  });

  // Request notification permission
  // Request notification permission
  function requestNotificationPermission() {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications.");
      return;
    }

    // If permission is already granted, return
    if (Notification.permission === "granted") {
      return;
    }

    // If permission hasn't been denied, request it
    if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          console.log("Notification permission granted.");
          // Show welcome notification
          showNotification("Welcome to Neon Chat", {
            body: "You'll now receive notifications for new messages",
            icon: "/images/notification-icon.png",
          });
        }
      });
    }
  }

  // Call this when the page loads
  requestNotificationPermission();

  // Function to show notification
  // Function to show notification
  function showNotification(title, options) {
    // Only show notification if:
    // 1. Notifications are supported
    // 2. Permission is granted
    // 3. The tab is not focused
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.hasFocus()) return;

    try {
      // Play sound with notification
      playNotificationSound();

      // Show the notification
      new Notification(title, {
        body: options.body || "",
        icon: options.icon || "/images/notification-icon.png",
        badge: "/images/notification-badge.png",
      });
    } catch (error) {
      console.error("Notification error:", error);
    }
  }

  // Close modal
  closeSoundSettingsBtn.addEventListener("click", () => {
    soundSettingsModal.classList.add("hidden");
  });

  // —— 5) initialize on load ——
  loadSoundSettings();

  // Sound settings modal events
  soundToggleBtn.addEventListener("click", () => {
    soundSettingsModal.classList.remove("hidden");
  });

  closeSoundSettingsModal.addEventListener("click", () => {
    soundSettingsModal.classList.add("hidden");
  });

  soundVolume.addEventListener("input", () => {
    const volume = parseFloat(soundVolume.value);
    volumeValue.textContent = `${Math.round(volume * 100)}%`;
  });

  testSoundBtn.addEventListener("click", playNotificationSound);

  saveSoundSettingsBtn.addEventListener("click", () => {
    saveSoundSettings();
    soundSettingsModal.classList.add("hidden");
  });

  // Track currently typing users
  const typingUsers = new Set();
  // Track messages that are currently being edited
  const editingMessages = new Map();
  // Track AI prompts in progress
  const aiPromptsInProgress = new Set();

  // Storage key for messages
  const STORAGE_KEY = `neonChat_${room}_messages`;

  const scrollToBottom = () => {
    messagesDiv.scrollTo({
      top: messagesDiv.scrollHeight,
      behavior: "smooth",
    });
  };

  // Load messages from localStorage
  function loadMessages() {
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        const messages = JSON.parse(savedMessages);
        messages.forEach((msg) => {
          displayMessage(msg, false); // false means don't save again
        });
        setTimeout(scrollToBottom, 100);
      } catch (e) {
        console.error("Failed to parse saved messages", e);
      }
    }
  }

  // Save message to localStorage
  function saveMessage(message) {
    let messages = [];
    const savedMessages = localStorage.getItem(STORAGE_KEY);

    if (savedMessages) {
      try {
        messages = JSON.parse(savedMessages);
      } catch (e) {
        console.error("Failed to parse existing messages", e);
      }
    }

    // Keep only the last 100 messages to prevent localStorage overflow
    messages.push(message);
    if (messages.length > 100) {
      messages = messages.slice(-100);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }

  // Update message in localStorage
  function updateMessageInStorage(messageId, newContent) {
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (!savedMessages) return;

    try {
      let messages = JSON.parse(savedMessages);
      const messageIndex = messages.findIndex((msg) => msg.id === messageId);
      if (messageIndex !== -1) {
        messages[messageIndex].text = newContent;
        messages[messageIndex].edited = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      }
    } catch (e) {
      console.error("Failed to update message in storage", e);
    }
  }

  // Remove message from localStorage
  function removeMessageFromStorage(messageId) {
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (!savedMessages) return;

    try {
      let messages = JSON.parse(savedMessages);
      messages = messages.filter((msg) => msg.id !== messageId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to remove message from storage", e);
    }
  }

  // Clear chat history
  function clearChatHistory() {
    if (!confirm("Are you sure?")) return;
    socket.emit("clearHistory");
    localStorage.removeItem(STORAGE_KEY);
    messagesDiv.innerHTML = "";
    displayMessage(
      { isSystem: true, text: "Chat history has been cleared" },
      false
    );
  }

  // Generate a unique ID for messages
  function generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Display a message in the chat
  function displayMessage(data, saveToStorage = true) {
    // Generate ID if not present
    if (!data.id) {
      data.id = generateMessageId();
    }

    // If we're already editing this message, skip
    if (editingMessages.has(data.id)) {
      return;
    }

    // Show notification for new messages that aren't from the current user or system
    if (!data.isSystem && data.username !== username) {
      const notificationTitle = `New message from ${data.username}`;
      const notificationOptions = {
        body: data.text || (data.image ? "Sent an image" : "New message"),
        icon: "/images/notification-icon.png",
        tag: data.id, // Group notifications by message ID
      };

      showNotification(notificationTitle, notificationOptions);
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = "message-container relative";
    messageDiv.dataset.messageId = data.id;

    const contentDiv = document.createElement("div");
    contentDiv.className = "message bg-gray-800 p-3 rounded-lg";

    if (data.isSystem) {
      contentDiv.className += " text-center text-purple-300 italic text-sm";
      contentDiv.textContent = data.text;
    } else {
      if (data.username === username) {
        contentDiv.className +=
          " ml-auto bg-gradient-to-r from-purple-700 to-pink-700";

        // Add action buttons for user's own messages
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "message-actions space-x-1 p-1";

        const editButton = document.createElement("button");
        editButton.className = "text-white hover:text-purple-200 text-xs";
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        editButton.title = "Edit";
        editButton.addEventListener("click", (e) => {
          e.stopPropagation();
          startEditingMessage(data.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "text-white hover:text-purple-200 text-xs";
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.title = "Delete";
        deleteButton.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteMessage(data.id);
        });

        actionsDiv.appendChild(editButton);
        actionsDiv.appendChild(deleteButton);
        messageDiv.appendChild(actionsDiv);
      } else {
        contentDiv.className += " mr-auto bg-gray-700";
        // Play notification sound for incoming messages (except our own)
        if (soundSettings.enabled && data.username !== username) {
          playNotificationSound();
        }
      }

      if (data.image) {
        const imgContainer = document.createElement("div");
        imgContainer.className = "mt-2";
        const img = document.createElement("img");
        img.className = "max-w-full max-h-48 rounded-lg";
        img.src = data.image;

        img.onload = function () {
          scrollToBottom(true);
        };
        img.onerror = function () {
          scrollToBottom(true);
        };

        imgContainer.appendChild(img);

        contentDiv.innerHTML = `
              <div class="flex justify-between items-baseline">
                <strong class="${
                  data.username === username
                    ? "text-pink-200"
                    : "text-purple-200"
                } text-sm">${data.username}</strong>
                <span class="text-xs text-purple-400 ml-2">${new Date(
                  data.timestamp || Date.now()
                ).toLocaleTimeString()}</span>
              </div>
              <div class="text-sm message-text mt-1">${data.text || ""}</div>
            `;
        contentDiv.appendChild(imgContainer);
      } else {
        // Regular text message
        let editedIndicator = data.edited
          ? '<span class="text-xs text-purple-400 italic">(edited)</span>'
          : "";

        // Special formatting for AI messages
        let messageContent = data.text || "";
        if (data.username === "AI") {
          messageContent = `
                <div class="flex justify-between items-baseline">
                  <strong class="text-purple-200 text-sm">${
                    data.username
                  }</strong>
                  <div>
                    ${editedIndicator}
                    <span class="text-xs text-purple-400 ml-2">${new Date(
                      data.timestamp || Date.now()
                    ).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div class="ai-response text-sm mt-1 p-2 rounded">
                  ${messageContent}
                </div>
              `;
        } else {
          messageContent = `
                <div class="flex justify-between items-baseline">
                  <strong class="${
                    data.username === username
                      ? "text-pink-200"
                      : "text-purple-200"
                  } text-sm">${data.username}</strong>
                  <div>
                    ${editedIndicator}
                    <span class="text-xs text-purple-400 ml-2">${new Date(
                      data.timestamp || Date.now()
                    ).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div class="text-sm message-text mt-1">${messageContent}</div>
              `;
        }

        contentDiv.innerHTML = messageContent;
      }
    }

    messageDiv.appendChild(contentDiv);

    // Replace existing message if it's an update
    const existingMessage = document.querySelector(
      `[data-message-id="${data.id}"]`
    );
    if (existingMessage) {
      existingMessage.replaceWith(messageDiv);
    } else {
      messagesDiv.appendChild(messageDiv);
    }

    // Scroll immediately for text messages
    if (!data.image) {
      setTimeout(() => scrollToBottom(), 50);
    }

    if (saveToStorage && !data.isSystem) {
      saveMessage(data);
    }
  }

  // Start editing a message
  function startEditingMessage(messageId) {
    // If already editing another message, cancel that first
    if (editingMessages.size > 0) {
      const [existingId, existingCallback] = editingMessages
        .entries()
        .next().value;
      cancelEditMessage(existingId, existingCallback);
    }

    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"] .message-text`
    );
    if (!messageElement) return; // Silently return if message not found

    const originalContent = messageElement.textContent;
    const input = document.createElement("input");
    input.className = "edit-input";
    input.value = originalContent;

    const saveEdit = () => {
      const newContent = input.value.trim();
      if (newContent && newContent !== originalContent) {
        socket.emit("editMessage", {
          id: messageId,
          text: newContent,
        });
      }
      editingMessages.delete(messageId);
      if (messageElement.parentNode) {
        messageElement.textContent = newContent || originalContent;
        input.remove();
      }
    };

    const cancelEdit = () => {
      editingMessages.delete(messageId);
      if (messageElement.parentNode) {
        messageElement.textContent = originalContent;
        input.remove();
      }
    };

    input.addEventListener("blur", saveEdit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        saveEdit();
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    });

    // Replace the text with the input field
    messageElement.textContent = "";
    messageElement.appendChild(input);
    input.focus();

    // Store the cancel callback
    editingMessages.set(messageId, cancelEdit);
  }

  // Cancel editing a message
  function cancelEditMessage(messageId, cancelCallback) {
    if (cancelCallback) {
      cancelCallback();
    }
    editingMessages.delete(messageId);
  }

  // Delete a message
  function deleteMessage(messageId) {
    socket.emit("deleteMessage", messageId);

    // Remove from DOM immediately
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (messageElement) {
      messageElement.remove();
    }

    // Remove from storage
    removeMessageFromStorage(messageId);
  }

  function handleAIPrompt() {
    const prompt = messageInput.value.trim();
    if (!prompt) return;

    // Check if we're already processing this prompt
    if (aiPromptsInProgress.has(prompt)) return;
    aiPromptsInProgress.add(prompt);

    // Show loading state
    const originalButtonHTML = aiPromptButton.innerHTML;
    aiPromptButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    aiPromptButton.disabled = true;

    // Send AI request
    socket.emit("aiRequest", prompt, (response) => {
      // Remove from in-progress set
      aiPromptsInProgress.delete(prompt);

      // Restore button state
      aiPromptButton.innerHTML = originalButtonHTML;
      aiPromptButton.disabled = false;

      if (response.error) {
        displayMessage(
          {
            isSystem: true,
            text: `AI Error: ${response.error}`,
            timestamp: new Date(),
          },
          false
        );
      } else {
        // Clear the input if the AI responded successfully
        messageInput.value = "";
      }
    });
  }

  imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 20 * 1024 * 1024) {
      const errorMsg = {
        isSystem: true,
        text: "Image too large (max 20MB)",
        timestamp: new Date(),
      };
      displayMessage(errorMsg, false);
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    fetch("/upload", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.imageUrl) {
          const messageData = {
            username,
            image: data.imageUrl,
            text: "", // Ensure text property exists
            timestamp: new Date(),
            id: generateMessageId(),
          };
          socket.emit("chatMessage", messageData);
          // Clear the input after successful upload
          e.target.value = "";
        }
      })
      .catch((error) => {
        console.error("Upload error:", error);
        const errorMsg = {
          isSystem: true,
          text: "Failed to upload image",
          timestamp: new Date(),
        };
        displayMessage(errorMsg, false);
        // Clear the input even if there's an error
        e.target.value = "";
      });
  });

  // Join chat room
  socket.emit("joinRoom", { username, room });

  // Load saved messages when page loads
  loadMessages();

  // Mobile menu toggle
  mobileMenuButton.addEventListener("click", () => {
    mobileUsersMenu.classList.remove("hidden");
    mobileUsersMenu.classList.add("visible");
  });

  closeMobileMenu.addEventListener("click", () => {
    mobileUsersMenu.classList.remove("visible");
    mobileUsersMenu.classList.add("hidden");
  });

  // Logout button
  logoutBtn.addEventListener("click", () => {
    window.location.href = "/";
  });

  // Clear history button
  clearHistoryBtn.addEventListener("click", clearChatHistory);

  // AI Help button
  aiHelpBtn.addEventListener("click", () => {
    aiHelpModal.classList.remove("hidden");
  });

  // Close AI Help modal
  closeAiHelpModal.addEventListener("click", () => {
    aiHelpModal.classList.add("hidden");
  });

  gotItButton.addEventListener("click", () => {
    aiHelpModal.classList.add("hidden");
  });

  // AI Prompt button
  aiPromptButton.addEventListener("click", handleAIPrompt);

  // Typing indicators
  let typingTimeout;
  let isTyping = false;

  messageInput.addEventListener("input", () => {
    if (!isTyping) {
      isTyping = true;
      socket.emit("typing", { isTyping: true });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit("typing", { isTyping: false });
    }, 2000);
  });

  // Handle typing status updates
  socket.on("typing", (data) => {
    if (data.isTyping) {
      typingUsers.add(data.username);
    } else {
      typingUsers.delete(data.username);
    }

    // Update typing indicator
    if (typingUsers.size > 0) {
      const names = Array.from(typingUsers);
      let typingText = "";

      if (names.length === 1) {
        typingText = `${names[0]} is typing...`;
      } else if (names.length === 2) {
        typingText = `${names[0]} and ${names[1]} are typing...`;
      } else {
        typingText = `${names[0]}, ${names[1]}, and others are typing...`;
      }

      typingUsersElement.textContent = typingText;
      typingIndicator.classList.remove("hidden");
    } else {
      typingIndicator.classList.add("hidden");
    }
  });

  // Message form submission
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    // Check if this is an AI command
    if (message.startsWith("@AI ") || message.startsWith("@ai ")) {
      const prompt = message.substring(4).trim();
      if (prompt) {
        messageInput.value = prompt;
        handleAIPrompt();
      }
      return;
    }

    const messageData = {
      username,
      text: message,
      timestamp: new Date(),
      id: generateMessageId(),
    };

    socket.emit("chatMessage", messageData);
    // Clear the input after sending
    messageInput.value = "";

    if (isTyping) {
      isTyping = false;
      socket.emit("typing", { isTyping: false });
      clearTimeout(typingTimeout);
    }
  });

  // handle history without saving
  socket.on("historyMessage", (data) => {
    displayMessage(data, /* saveToStorage */ false);
  });

  // handle brand-new messages (from you or others) *and* save them
  socket.on("message", (data) => {
    displayMessage(data, /* saveToStorage */ true);
  });

  // Handle AI responses
  socket.on("aiResponse", (response) => {
    displayMessage({
      username: "AI",
      text: response,
      timestamp: new Date(),
      id: generateMessageId(),
    });
  });

  // Handle edited messages
  socket.on("messageEdited", (data) => {
    // If we're currently editing this message, cancel that
    if (editingMessages.has(data.id)) {
      const cancelCallback = editingMessages.get(data.id);
      cancelEditMessage(data.id, cancelCallback);
    }

    // Find the message in the DOM
    const messageElement = document.querySelector(
      `[data-message-id="${data.id}"]`
    );
    if (messageElement) {
      // Update the message content
      const messageTextElement = messageElement.querySelector(".message-text");
      if (messageTextElement) {
        messageTextElement.textContent = data.text;
      }

      // Add edited indicator
      const timeElement = messageElement.querySelector(
        ".text-xs.text-purple-400"
      );
      if (timeElement && !timeElement.innerHTML.includes("(edited)")) {
        timeElement.innerHTML = `(edited) ${timeElement.innerHTML}`;
      }
    }

    // Update in storage
    updateMessageInStorage(data.id, data.text);
  });

  // Handle deleted messages
  socket.on("messageDeleted", (messageId) => {
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (messageElement) {
      messageElement.remove();
    }

    // Remove from storage
    removeMessageFromStorage(messageId);
  });

  // Handle user list updates
  socket.on("userList", (users) => {
    onlineUsersDesktop.innerHTML = "";
    onlineUsersMobile.innerHTML = "";

    users.forEach((user) => {
      const userEl = document.createElement("li");
      userEl.className = "text-purple-200 flex items-center text-sm";
      userEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            ${user.username}
            <span class="text-xs text-purple-400 ml-2">${new Date(
              user.lastSeen
            ).toLocaleTimeString()}</span>
          `;

      onlineUsersDesktop.appendChild(userEl.cloneNode(true));
      onlineUsersMobile.appendChild(userEl.cloneNode(true));
    });

    // Update online count
    const count = users.length;
    onlineCount.textContent = count;
    mobileOnlineCount.textContent = count;
  });

  // Handle errors
  socket.on("error", (error) => {
    const errorDiv = document.createElement("div");
    errorDiv.className =
      "bg-red-900 text-white p-2 rounded-lg text-center text-xs";
    errorDiv.textContent = error;
    messagesDiv.appendChild(errorDiv);
    scrollToBottom();
  });

  // Add resize observer to handle layout changes
  const resizeObserver = new ResizeObserver(() => {
    scrollToBottom();
  });
  resizeObserver.observe(messagesDiv);

  // Save messages before page unload
  window.addEventListener("beforeunload", () => {
    if (isTyping) {
      socket.emit("typing", { isTyping: false });
    }
  });
});
