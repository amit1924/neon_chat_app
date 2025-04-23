(() => {
  const socket = io(); // assumes io() is already connected
  let currentDMUser = null; // who you're chatting with right now
  const dmContainers = {}; // store per-user message containers
  let username = ""; // will be set when user joins

  // Initialize private chat UI
  function initPrivateChatUI() {
    // 1️⃣ Build the DM sidebar
    const dmSidebar = document.createElement("aside");
    dmSidebar.className =
      "dm-sidebar hidden md:block w-48 bg-gray-800 border-r border-purple-900 p-4 overflow-y-auto";
    dmSidebar.innerHTML = `
        <h2 class="text-purple-400 font-bold mb-2">Direct Messages</h2>
        <ul id="dmUserList" class="space-y-1"></ul>
      `;

    // Insert the sidebar before the main chat area
    const mainContainer = document.querySelector(".flex-1.flex.flex-col");
    mainContainer.parentNode.insertBefore(dmSidebar, mainContainer);

    // Add styles for DM windows
    const style = document.createElement("style");
    style.textContent = `
        .dm-window {
          display: none;
          background: rgba(55, 65, 81, 0.7);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }
        .dm-window.active {
          display: block;
        }
        .dm-message {
          margin-bottom: 0.5rem;
          padding: 0.5rem;
          border-radius: 0.25rem;
        }
        .dm-message.self {
          background: rgba(124, 58, 237, 0.2);
          margin-left: auto;
          max-width: 80%;
        }
        .dm-message.other {
          background: rgba(55, 65, 81, 0.5);
          margin-right: auto;
          max-width: 80%;
        }
      `;
    document.head.appendChild(style);
  }

  // 2️⃣ When we get the online users list, populate DM list
  socket.on("userList", (users) => {
    const dmList = document.getElementById("dmUserList");
    if (!dmList) return;

    dmList.innerHTML = "";
    users.forEach((user) => {
      if (user.username !== username) {
        const li = document.createElement("li");
        li.textContent = user.username;
        li.className =
          "cursor-pointer text-purple-200 hover:text-purple-100 p-1 rounded";
        li.addEventListener("click", () => openDM(user.username));
        dmList.appendChild(li);
      }
    });
  });

  // 3️⃣ Open a DM window with a user
  function openDM(toUser) {
    currentDMUser = toUser;

    // If we haven't created a container for this user, do so
    if (!dmContainers[toUser]) {
      const dmDiv = document.createElement("div");
      dmDiv.id = `dm-${toUser}`;
      dmDiv.className = "dm-window";
      dmDiv.innerHTML = `
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-purple-300">Chat with ${toUser}</h3>
            <button class="close-dm text-purple-400 hover:text-purple-200" data-user="${toUser}">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="messages-container" style="max-height: 300px; overflow-y: auto;"></div>
          <div class="dm-input mt-2 flex">
            <input type="text" class="dm-message-input flex-1 bg-gray-700 text-purple-100 p-2 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-purple-500" placeholder="Type message...">
            <button class="dm-send-btn bg-purple-600 hover:bg-purple-700 text-white px-3 rounded-r-lg">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        `;

      document.getElementById("messages").appendChild(dmDiv);
      dmContainers[toUser] = dmDiv;

      // Set up event listeners for this DM window
      const input = dmDiv.querySelector(".dm-message-input");
      const sendBtn = dmDiv.querySelector(".dm-send-btn");
      const closeBtn = dmDiv.querySelector(".close-dm");

      sendBtn.addEventListener("click", () => sendDM(toUser, input));
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendDM(toUser, input);
      });

      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeDM(toUser);
      });

      // Fetch history
      socket.emit("getPrivateChatHistory", { withUser: toUser }, (history) => {
        const container = dmDiv.querySelector(".messages-container");
        history.forEach((msg) => appendDMMessage(msg, container));
        container.scrollTop = container.scrollHeight;
      });
    }

    // Show this window and hide others
    Object.values(dmContainers).forEach((div) =>
      div.classList.remove("active")
    );
    dmContainers[toUser].classList.add("active");

    // Focus the input
    const input = dmContainers[toUser].querySelector(".dm-message-input");
    if (input) input.focus();
  }

  // 4️⃣ Close a DM window
  function closeDM(user) {
    if (dmContainers[user]) {
      dmContainers[user].remove();
      delete dmContainers[user];
    }
    if (currentDMUser === user) {
      currentDMUser = null;
    }
  }

  // 5️⃣ Send a DM
  function sendDM(toUser, inputElement) {
    const text = inputElement.value.trim();
    if (!text || !toUser) return;

    socket.emit("privateMessage", { to: toUser, text }, (res) => {
      if (res.error) {
        console.error(res.error);
      } else {
        // Clear input on success
        inputElement.value = "";
      }
    });
  }

  // 6️⃣ Handle incoming private messages
  socket.on("privateMessage", (msg) => {
    const container = dmContainers[msg.from === username ? msg.to : msg.from];
    if (!container) {
      // If window isn't open, open it
      openDM(msg.from === username ? msg.to : msg.from);
    }
    const messagesContainer = container.querySelector(".messages-container");
    appendDMMessage(msg, messagesContainer);
  });

  // 7️⃣ Append a message to a DM window
  function appendDMMessage(msg, container) {
    if (!container) return;

    const div = document.createElement("div");
    div.className = `dm-message ${msg.from === username ? "self" : "other"}`;
    div.innerHTML = `
        <div class="text-xs ${
          msg.from === username ? "text-pink-200" : "text-purple-200"
        }">${msg.from}</div>
        <div class="text-sm">${msg.text}</div>
        <div class="text-xs text-purple-400 text-right">${msg.time}</div>
      `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // 8️⃣ Initialize when user joins
  socket.on("joinSuccess", (data) => {
    username = data.username;
    initPrivateChatUI();
  });

  // 9️⃣ Handle user status changes
  socket.on("userStatus", ({ username: user, isOnline }) => {
    const dmList = document.getElementById("dmUserList");
    if (!dmList) return;

    const items = dmList.querySelectorAll("li");
    items.forEach((item) => {
      if (item.textContent === user) {
        item.style.color = isOnline ? "#e9d5ff" : "#9ca3af";
      }
    });
  });
})();
