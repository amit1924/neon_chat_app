document.addEventListener("DOMContentLoaded", () => {
  // Initialize theme toggle
  initThemeToggle();

  // Check which page we're on
  if (document.getElementById("joinForm")) {
    initJoinPage();
  } else if (document.getElementById("messageForm")) {
    initChatPage();
  }
});

function initThemeToggle() {
  const themeToggle =
    document.getElementById("themeToggle") || createThemeToggle();
  const currentTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.classList.add(currentTheme);
  themeToggle.innerHTML =
    currentTheme === "dark"
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';

  themeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    themeToggle.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  });
}

function createThemeToggle() {
  const themeToggle = document.createElement("button");
  themeToggle.id = "themeToggle";
  themeToggle.className =
    "absolute top-4 right-4 p-2 rounded-full bg-gray-700 text-purple-300 hover:bg-gray-600";
  document.body.appendChild(themeToggle);
  return themeToggle;
}

function initJoinPage() {
  const joinForm = document.getElementById("joinForm");
  const usernameInput = document.getElementById("username");
  const roomInput = document.getElementById("room");

  // Load previous username if exists
  const savedUsername = localStorage.getItem("username");
  if (savedUsername) {
    usernameInput.value = savedUsername;
  }

  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const room = roomInput.value.trim() || "general";

    if (!username) return;

    // Save username to localStorage
    localStorage.setItem("username", username);

    // Redirect to chat page with query params
    window.location.href = `/chat?username=${encodeURIComponent(
      username
    )}&room=${encodeURIComponent(room)}`;
  });
}

function initChatPage() {
  // Get username and room from URL
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get("username");
  const room = urlParams.get("room") || "general";

  if (!username) {
    window.location.href = "/";
    return;
  }

  // Set room name in header
  document.getElementById("roomName").textContent = room;

  // Connect to socket.io
  const socket = io();

  // Join chat room
  socket.emit("joinRoom", { username, room });

  // DOM elements
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messagesContainer = document.getElementById("messages");
  const typingIndicator = document.getElementById("typingIndicator");
  const typingUsers = document.getElementById("typingUsers");
  const logoutBtn = document.getElementById("logoutBtn");
  const imageUpload = document.getElementById("imageUpload");
  const searchBtn = document.createElement("button");

  // Create online users panel
  const onlineUsersList = document.createElement("div");
  onlineUsersList.id = "onlineUsers";
  onlineUsersList.className =
    "hidden md:block w-64 bg-gray-800 border-l border-purple-900 p-4 overflow-y-auto";
  document.querySelector(".flex-1").parentElement.classList.add("flex");
  document.querySelector(".flex-1").parentElement.appendChild(onlineUsersList);

  // Create pinned messages container
  const pinnedContainer = document.createElement("div");
  pinnedContainer.id = "pinnedMessages";
  pinnedContainer.className =
    "bg-gray-800 border-b border-purple-900 p-3 hidden";
  messagesContainer.parentElement.prepend(pinnedContainer);

  // Add search button to header
  searchBtn.className = "ml-4 p-2 text-purple-300 hover:text-purple-100";
  searchBtn.innerHTML = '<i class="fas fa-search"></i>';
  document.querySelector("header > div").appendChild(searchBtn);

  // Add formatting toolbar
  const formattingToolbar = document.createElement("div");
  formattingToolbar.className = "flex space-x-2 mb-2 text-sm";
  const formats = [
    { icon: "bold", tag: "**", title: "Bold" },
    { icon: "italic", tag: "_", title: "Italic" },
    { icon: "strikethrough", tag: "~~", title: "Strikethrough" },
    { icon: "code", tag: "`", title: "Inline Code" },
    { icon: "link", tag: "[]()", title: "Link" },
  ];

  formats.forEach((format) => {
    const btn = document.createElement("button");
    btn.className = "p-1 text-purple-300 hover:text-purple-100";
    btn.innerHTML = `<i class="fas fa-${format.icon}"></i>`;
    btn.title = format.title;
    btn.onclick = (e) => {
      e.preventDefault();
      insertText(format.tag);
    };
    formattingToolbar.appendChild(btn);
  });

  messageForm.parentElement.insertBefore(formattingToolbar, messageForm);

  function insertText(tag) {
    const input = messageInput;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selectedText = input.value.substring(start, end);
    let textToInsert;

    if (tag === "[]()") {
      textToInsert = selectedText ? `[${selectedText}](url)` : "[](url)";
    } else {
      textToInsert = tag + selectedText + tag;
    }

    input.value =
      input.value.substring(0, start) +
      textToInsert +
      input.value.substring(end);
    input.focus();
    input.setSelectionRange(
      tag === "[]()" ? start + (selectedText ? 1 : 0) : start + tag.length,
      tag === "[]()"
        ? start + tag.length - 3 + (selectedText ? selectedText.length : 0)
        : end + tag.length
    );
  }

  // Load previous messages from localStorage
  const messageHistoryKey = `chatMessages_${room}`;
  const messageHistory =
    JSON.parse(localStorage.getItem(messageHistoryKey)) || [];
  messageHistory.forEach((msg) => appendMessage(msg));

  // Scroll to bottom of messages
  scrollToBottom();

  // Window focus state for notifications
  let isWindowFocused = true;
  window.addEventListener("focus", () => {
    isWindowFocused = true;
  });
  window.addEventListener("blur", () => {
    isWindowFocused = false;
  });

  // Notification sound
  const notificationSound = new Audio("/notification.mp3");

  // Message form submission
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    // Emit message to server
    socket.emit("chatMessage", {
      text: message,
      image: null,
    });

    // Clear input
    messageInput.value = "";

    // Focus input again
    messageInput.focus();
  });

  // Handle image upload
  imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("Image size must be less than 20MB");
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
        if (data.error) {
          alert(data.error);
        } else {
          // Send image message
          socket.emit("chatMessage", {
            text: "",
            image: data.imageUrl,
          });
        }
      })
      .catch((error) => {
        console.error("Error uploading image:", error);
        alert("Error uploading image");
      })
      .finally(() => {
        // Reset file input
        e.target.value = "";
      });
  });

  // Typing indicators
  let typingTimeout;
  messageInput.addEventListener("input", () => {
    socket.emit("typing", true);

    // Clear previous timeout
    clearTimeout(typingTimeout);

    // Set timeout to stop typing indicator after 2 seconds of inactivity
    typingTimeout = setTimeout(() => {
      socket.emit("typing", false);
    }, 2000);

    // Check for @ mentions
    const text = messageInput.value;
    const lastWord = text.split(/\s+/).pop();
    if (lastWord.startsWith("@")) {
      showUserSuggestions(lastWord.substring(1));
    } else {
      hideUserSuggestions();
    }
  });

  function showUserSuggestions(partial) {
    // In a real implementation, you would get this from the online users list
    const suggestions =
      document.getElementById("userSuggestions") || createUserSuggestions();
    suggestions.innerHTML = "";

    // Filter online users (mock data)
    const mockUsers = ["alice", "bob", "charlie"].filter((user) =>
      user.toLowerCase().includes(partial.toLowerCase())
    );

    mockUsers.forEach((user) => {
      const item = document.createElement("div");
      item.className = "p-2 hover:bg-purple-900 cursor-pointer";
      item.textContent = user;
      item.onclick = () => {
        const text = messageInput.value;
        const lastAt = text.lastIndexOf("@");
        messageInput.value = text.substring(0, lastAt) + "@" + user + " ";
        messageInput.focus();
        hideUserSuggestions();
      };
      suggestions.appendChild(item);
    });

    if (mockUsers.length > 0) {
      suggestions.classList.remove("hidden");
    }
  }

  function hideUserSuggestions() {
    const suggestions = document.getElementById("userSuggestions");
    if (suggestions) suggestions.classList.add("hidden");
  }

  function createUserSuggestions() {
    const container = document.createElement("div");
    container.id = "userSuggestions";
    container.className =
      "hidden absolute bottom-16 left-0 bg-gray-800 border border-purple-900 rounded-lg w-64 max-h-48 overflow-y-auto z-10";
    messageForm.parentElement.appendChild(container);
    return container;
  }

  // Search functionality
  searchBtn.addEventListener("click", () => {
    const searchTerm = prompt("Search messages:");
    if (searchTerm) {
      const messages = Array.from(messagesContainer.children);
      messages.forEach((msg) => {
        const msgText = msg.textContent.toLowerCase();
        if (msgText.includes(searchTerm.toLowerCase())) {
          msg.classList.add("bg-purple-900");
          msg.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          msg.classList.remove("bg-purple-900");
        }
      });
    }
  });

  // Logout button
  logoutBtn.addEventListener("click", () => {
    window.location.href = "/";
  });

  // Socket.io event listeners
  socket.on("message", (message) => {
    // Check if message already exists (to prevent duplicates)
    const messageExists = messageHistory.some((msg) => msg.id === message.id);

    if (!messageExists) {
      if (message.username !== username && !isWindowFocused) {
        notificationSound.play();
      }

      appendMessage(message);

      // Save to message history
      messageHistory.push(message);
      if (messageHistory.length > 100) {
        messageHistory.shift(); // Keep only last 100 messages
      }
      localStorage.setItem(messageHistoryKey, JSON.stringify(messageHistory));
    }
  });

  socket.on("typing", (data) => {
    if (data.isTyping) {
      // Add user to typing indicator
      if (!typingIndicator.textContent.includes(data.username)) {
        if (typingUsers.textContent) {
          typingUsers.textContent += `, ${data.username}`;
        } else {
          typingUsers.textContent = `${data.username} is typing...`;
        }
      }
      typingIndicator.classList.remove("hidden");
    } else {
      // Remove user from typing indicator
      const users = typingUsers.textContent
        .replace(" is typing...", "")
        .split(", ");
      const index = users.indexOf(data.username);
      if (index !== -1) {
        users.splice(index, 1);
        if (users.length > 0) {
          typingUsers.textContent = `${users.join(", ")} is typing...`;
        } else {
          typingIndicator.classList.add("hidden");
        }
      }
    }
  });

  socket.on("userList", (users) => {
    onlineUsersList.innerHTML = `
      <h3 class="font-bold text-purple-300 mb-3">Online (${users.length})</h3>
      <ul class="space-y-2">
        ${users
          .map(
            (user) => `<li class="flex items-center">
          <span class="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
          ${user.username}
        </li>`
          )
          .join("")}
      </ul>
    `;
  });

  socket.on("pinnedMessage", (message) => {
    pinnedContainer.classList.remove("hidden");

    const pinnedMsg = document.createElement("div");
    pinnedMsg.className = "bg-purple-900 p-3 rounded-lg mb-2";
    pinnedMsg.innerHTML = `
      <div class="text-xs text-purple-300 mb-1">📌 Pinned by ${message.pinnedBy}</div>
      <div>${message.text}</div>
    `;
    pinnedContainer.appendChild(pinnedMsg);
  });

  // Handle message editing
  socket.on("messageEdited", ({ id, text }) => {
    const messageElement = document.querySelector(`[data-id="${id}"]`);
    if (messageElement) {
      const messageText = messageElement.querySelector(".mt-1");
      if (messageText) {
        messageText.textContent = text;
      }
    }
  });

  // Handle message deletion
  socket.on("messageDeleted", (messageId) => {
    const messageElement = document.querySelector(`[data-id="${messageId}"]`);
    if (messageElement) {
      messageElement.remove();
    }
  });

  // Handle reactions
  socket.on("reaction", ({ messageId, reaction, count }) => {
    const messageElement = document.querySelector(`[data-id="${messageId}"]`);
    if (messageElement) {
      // Find or create reaction display
      let reactionDisplay = messageElement.querySelector(".reaction-display");
      if (!reactionDisplay) {
        reactionDisplay = document.createElement("div");
        reactionDisplay.className = "reaction-display flex space-x-1 mt-1";
        messageElement.appendChild(reactionDisplay);
      }

      // Update or add the reaction
      const reactionBadge = reactionDisplay.querySelector(
        `[data-reaction="${reaction}"]`
      );
      if (reactionBadge) {
        reactionBadge.textContent = `${reaction} ${count}`;
      } else {
        const badge = document.createElement("span");
        badge.className = "text-xs bg-purple-900 px-2 py-1 rounded-full";
        badge.dataset.reaction = reaction;
        badge.textContent = `${reaction} ${count}`;
        reactionDisplay.appendChild(badge);
      }
    }
  });

  // Handle read receipts
  socket.on("messageReadBy", ({ messageId, username }) => {
    const receipt = document.getElementById(`read-${messageId}`);
    if (receipt) {
      if (receipt.textContent) {
        receipt.textContent += `, ${username}`;
      } else {
        receipt.textContent = `Read by ${username}`;
      }
    }
  });

  // Helper functions
  function appendMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", "p-4", "rounded-lg", "max-w-3xl");
    messageElement.dataset.id = message.id;

    if (message.isSystem) {
      messageElement.classList.add(
        "bg-gray-700",
        "text-center",
        "text-purple-300",
        "italic"
      );
      messageElement.innerHTML = `<span>${message.text}</span> <span class="text-xs opacity-70 ml-2">${message.time}</span>`;
    } else {
      messageElement.classList.add("bg-gray-700", "shadow-md");

      if (message.username === username) {
        messageElement.classList.add(
          "ml-auto",
          "bg-gradient-to-r",
          "from-purple-700",
          "to-pink-700"
        );
      } else {
        messageElement.classList.add("mr-auto", "bg-gray-700");
      }

      messageElement.innerHTML = `
        <div class="font-bold text-sm ${
          message.username === username ? "text-pink-200" : "text-purple-200"
        }">
          ${message.username} <span class="text-xs opacity-70 ml-2">${
        message.time
      }</span>
        </div>
        ${message.text ? `<div class="mt-1">${message.text}</div>` : ""}
        ${
          message.image
            ? `<div class="mt-2"><img src="${message.image}" alt="Uploaded image" class="max-w-full max-h-64 rounded-lg border border-purple-900"></div>`
            : ""
        }
      `;

      // Add reactions container
      const reactionsContainer = document.createElement("div");
      reactionsContainer.className = "flex space-x-1 mt-2";

      const reactions = ["👍", "❤️", "😂", "😮", "😢"];
      reactions.forEach((reaction) => {
        const btn = document.createElement("button");
        btn.textContent = reaction;
        btn.className = "text-sm hover:scale-125 transition-transform";
        btn.onclick = () =>
          socket.emit("react", { messageId: message.id, reaction });
        reactionsContainer.appendChild(btn);
      });

      messageElement.appendChild(reactionsContainer);

      // Add existing reactions
      if (
        message.reactions &&
        Object.values(message.reactions).some((count) => count > 0)
      ) {
        const reactionDisplay = document.createElement("div");
        reactionDisplay.className = "flex space-x-1 mt-1";
        Object.entries(message.reactions).forEach(([reaction, count]) => {
          if (count > 0) {
            const badge = document.createElement("span");
            badge.className = "text-xs bg-purple-900 px-2 py-1 rounded-full";
            badge.textContent = `${reaction} ${count}`;
            reactionDisplay.appendChild(badge);
          }
        });
        messageElement.appendChild(reactionDisplay);
      }

      // Add edit/delete buttons for user's own messages
      if (message.username === username) {
        const actions = document.createElement("div");
        actions.className = "flex space-x-2 mt-2 text-xs";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "text-purple-300 hover:text-purple-100";
        editBtn.onclick = () => editMessage(message.id, message.text);
        actions.appendChild(editBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "text-pink-300 hover:text-pink-100";
        deleteBtn.onclick = () => socket.emit("deleteMessage", message.id);
        actions.appendChild(deleteBtn);

        const pinBtn = document.createElement("button");
        pinBtn.textContent = "Pin";
        pinBtn.className = "text-yellow-300 hover:text-yellow-100";
        pinBtn.onclick = () => socket.emit("pinMessage", message.id);
        actions.appendChild(pinBtn);

        messageElement.appendChild(actions);
      }

      // Add read receipt for others' messages
      if (message.username !== username) {
        const readReceipt = document.createElement("div");
        readReceipt.className = "text-right text-xs text-purple-400 mt-1";
        readReceipt.id = `read-${message.id}`;
        messageElement.appendChild(readReceipt);
      }
    }

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function editMessage(id, currentText) {
    const input = document.getElementById("messageInput");
    input.value = currentText;
    input.focus();

    // Change send button to update button temporarily
    const form = document.getElementById("messageForm");
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = 'Update <i class="fas fa-save ml-1"></i>';
    form.onsubmit = (e) => {
      e.preventDefault();
      const newText = input.value.trim();
      if (newText) {
        socket.emit("editMessage", { id, text: newText });
        input.value = "";
        submitBtn.innerHTML = originalText;
        form.onsubmit = handleMessageSubmit; // Restore original handler
      }
    };
  }

  function handleMessageSubmit(e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;
    socket.emit("chatMessage", { text: message, image: null });
    messageInput.value = "";
    messageInput.focus();
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Track read messages
  messagesContainer.addEventListener(
    "scroll",
    debounce(() => {
      const containerBottom =
        messagesContainer.scrollTop + messagesContainer.clientHeight;
      const messages = Array.from(messagesContainer.children);

      messages.forEach((msg) => {
        const msgBottom = msg.offsetTop + msg.offsetHeight;
        if (msgBottom < containerBottom) {
          const messageId = msg.dataset.id;
          if (messageId) socket.emit("messageRead", messageId);
        }
      });
    }, 500)
  );

  function debounce(func, wait) {
    let timeout;
    return function () {
      const context = this,
        args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }
}
