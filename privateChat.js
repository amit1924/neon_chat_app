const { v4: uuidv4 } = require("uuid");
const sanitizeHtml = require("sanitize-html");

class PrivateChat {
  constructor() {
    this.privateMessages = {}; // Structure: { user1-user2: [messages] }
    this.onlineUsers = {}; // Track all connected users: { username: socketId }
  }

  initialize(io) {
    this.io = io;
    return this;
  }

  setupSocketHandlers(socket) {
    // Track user connection
    socket.on("setUsername", (username) => {
      this.onlineUsers[username] = socket.id;
      socket.username = username;
      this.notifyUserStatus(username, true);
    });

    // Handle private messages
    socket.on("privateMessage", ({ to, text }, callback) => {
      try {
        if (!socket.username || !this.onlineUsers[socket.username]) {
          throw new Error("You must set a username first");
        }

        if (!this.onlineUsers[to]) {
          throw new Error("Recipient is not online");
        }

        // Sanitize message
        const cleanText = sanitizeHtml(text, {
          allowedTags: [],
          allowedAttributes: {},
        });

        // Create message object
        const message = {
          id: uuidv4(),
          from: socket.username,
          to,
          text: cleanText,
          time: new Date().toLocaleTimeString(),
          read: false,
        };

        // Store message (both directions for easy retrieval)
        const chatKey1 = `${socket.username}-${to}`;
        const chatKey2 = `${to}-${socket.username}`;

        if (!this.privateMessages[chatKey1])
          this.privateMessages[chatKey1] = [];
        if (!this.privateMessages[chatKey2])
          this.privateMessages[chatKey2] = [];

        this.privateMessages[chatKey1].push(message);
        this.privateMessages[chatKey2].push(message);

        // Emit to recipient
        this.io.to(this.onlineUsers[to]).emit("privateMessage", message);

        // Also emit to sender (for their own UI)
        socket.emit("privateMessage", message);

        if (typeof callback === "function") {
          callback({ success: true });
        }
      } catch (error) {
        console.error("Private message error:", error);
        if (typeof callback === "function") {
          callback({ error: error.message });
        } else {
          socket.emit("privateMessageError", error.message);
        }
      }
    });

    // Handle request for private chat history
    socket.on("getPrivateChatHistory", ({ withUser }, callback) => {
      try {
        if (!socket.username) {
          throw new Error("You must be logged in");
        }

        const chatKey1 = `${socket.username}-${withUser}`;
        const chatKey2 = `${withUser}-${socket.username}`;

        const history =
          this.privateMessages[chatKey1] ||
          this.privateMessages[chatKey2] ||
          [];

        if (typeof callback === "function") {
          callback(history);
        }
      } catch (error) {
        console.error("Private chat history error:", error);
        if (typeof callback === "function") {
          callback({ error: error.message });
        }
      }
    });

    // Update online users tracking on disconnect
    socket.on("disconnect", () => {
      if (socket.username && this.onlineUsers[socket.username]) {
        delete this.onlineUsers[socket.username];
        this.notifyUserStatus(socket.username, false);
      }
    });
  }

  notifyUserStatus(username, isOnline) {
    this.io.emit("userStatus", {
      username,
      isOnline,
    });
  }

  getOnlineUsers() {
    return Object.keys(this.onlineUsers);
  }
}

module.exports = function (io) {
  return new PrivateChat(io);
};
