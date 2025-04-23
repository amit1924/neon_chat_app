const express = require("express");
const socketio = require("socket.io");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sanitizeHtml = require("sanitize-html");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

///////////////

class AIService {
  static async generateResponse(prompt, context = []) {
    try {
      const payload = {
        model: "gpt-3.5-turbo-16k", // or "gpt-4" for more depth
        messages: [
          {
            role: "system",
            content: `
<div style="line-height:1.6; word-spacing:0.15em;">
  You are a vibrant, detail-oriented AI assistant. For <strong>every response</strong>, follow these rules:

  <span style="color:#00FFCC; font-weight:bold;">• Formatting Guidelines</span><br>
  - <span style="color:#FF00FF;">Headings</span>: Bold with neon colors. Example:<br>
    <span style="color:#FF00FF; font-weight:bold;">Topic Name</span><br>
  - <span style="color:#33FF33;">Bullet Points</span>: <strong>10+ per response</strong>, each 1–2 sentences.<br>
  - <span style="color:#9966FF;">Highlighting</span>:<br>
    • <span style="color:#FFCC00;">Key terms</span> in gold.<br>
    • <span style="color:#00FFFF;">Technical jargon</span> in cyan.<br>
    • <span style="color:#FF3366;">Names/dates</span> in pink.<br><br>

  <span style="color:#00FFCC; font-weight:bold;">• Content Rules</span><br>
  1. <span style="color:#FF9900;">Define the topic</span> clearly in the first bullet.<br>
  2. <span style="color:#33FF33;">Add 2–3 use cases</span> or real-world applications.<br>
  3. <span style="color:#9966FF;">Include trivia/history</span> (e.g., "Invented by X in Y").<br>
  4. <span style="color:#00FFFF;">Compare/contrast</span> with related topics if relevant.<br>
  5. <span style="color:#FF00FF;">End with a fun fact</span> or surprising detail.<br><br>

  <span style="color:#00FFCC; font-weight:bold;">• Length Requirement</span><br>
  Your response must be <strong>at least 200 words</strong> and contain <strong>10+ bullet points</strong>.<br><br>

  <em>Wrap all of your HTML output in this same &lt;div&gt; so that line-height and word-spacing are applied.</em>
</div>
            `.trim(),
          },
          // map recent chat context into messages array
          ...context.map((msg) => ({
            role: msg.username === "AI" ? "assistant" : "user",
            content: msg.text,
          })),
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 12000,
      };

      const response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("AI Error:", error);
      return `<div style="color:#FF0000; font-weight:bold; line-height:1.6; word-spacing:0.15em;">
                ⚠️ Error generating response. Details: ${error.message}
              </div>`;
    }
  }
}

// In-memory storage for messages and users
const chatRooms = {}; // Structure: { roomName: { messages: [], users: [], pinnedMessages: [] } }
const messageRateLimits = {};
const userSoundSettings = {}; // Store user sound preferences

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb("Error: Images only (JPEG, JPG, PNG, GIF)");
    }
  },
}).single("image");

// Middleware
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public/chat.html"));
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Socket.io setup
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("New user connected");

  // Join room
  socket.on("joinRoom", ({ username, room }) => {
    try {
      // Validate input
      if (!username || !room) {
        throw new Error("Username and room are required");
      }

      socket.join(room);

      // Initialize room if it doesn't exist
      if (!chatRooms[room]) {
        chatRooms[room] = {
          messages: [],
          users: [],
          pinnedMessages: [],
        };
      }

      // Initialize user sound settings with defaults
      if (!userSoundSettings[username]) {
        userSoundSettings[username] = {
          enabled: true,
          volume: 0.5,
          sound: "default",
        };
      }

      // Add user to room
      if (!chatRooms[room].users.some((u) => u.username === username)) {
        chatRooms[room].users.push({
          username,
          id: socket.id,
          lastSeen: new Date(),
        });
      }

      // Welcome current user
      const welcomeMessage = {
        id: uuidv4(),
        username: "ChatBot",
        text: `Welcome to the chat, ${username}!`,
        time: new Date().toLocaleTimeString(),
        isSystem: true,
      };
      socket.emit("message", welcomeMessage);

      // Send message history
      chatRooms[room].messages.forEach((msg) => {
        socket.emit("historyMessage", msg);
      });

      // Send pinned messages
      chatRooms[room].pinnedMessages.forEach((msg) => {
        socket.emit("pinnedMessage", msg);
      });

      // Send sound settings to the user
      socket.emit("soundSettings", userSoundSettings[username]);

      // Broadcast when a user connects
      const joinMessage = {
        id: uuidv4(),
        username: "ChatBot",
        text: `${username} has joined the chat`,
        time: new Date().toLocaleTimeString(),
        isSystem: true,
      };
      socket.broadcast.to(room).emit("message", joinMessage);
      chatRooms[room].messages.push(joinMessage);

      // Send updated user list
      updateUserList(room);

      // Store user data
      socket.username = username;
      socket.room = room;
    } catch (error) {
      console.error("Join room error:", error);
      socket.emit("error", error.message);
    }
  });

  // Listen for chat messages
  socket.on("chatMessage", (msg) => {
    try {
      // Rate limiting
      const now = Date.now();
      if (
        messageRateLimits[socket.id] &&
        now - messageRateLimits[socket.id] < 1000
      ) {
        throw new Error("Message rate limit exceeded (1 message per second)");
      }
      messageRateLimits[socket.id] = now;

      // Validate message - either text or image must be present
      if (!msg || (typeof msg.text !== "string" && !msg.image)) {
        throw new Error("Invalid message format - must contain text or image");
      }

      const cleanText = msg.text
        ? sanitizeHtml(msg.text, {
            allowedTags: [],
            allowedAttributes: {},
          })
        : "";

      const message = {
        id: uuidv4(),
        username: socket.username,
        text: cleanText,
        image: msg.image,
        time: new Date().toLocaleTimeString(),
        isSystem: false,
        reactions: {},
        readBy: [],
      };

      chatRooms[socket.room].messages.push(message);

      // Emit message with sound notification flag
      io.to(socket.room).emit("message", {
        ...message,
        playSound: message.username !== socket.username, // Don't play sound for sender
      });
    } catch (error) {
      console.error("Chat message error:", error);
      socket.emit("error", error.message);
    }
  });

  // Handle sound settings updates
  socket.on("updateSoundSettings", (settings) => {
    try {
      if (!socket.username) return;

      // Validate settings
      if (
        typeof settings.enabled !== "boolean" ||
        typeof settings.volume !== "number" ||
        settings.volume < 0 ||
        settings.volume > 1 ||
        !["default", "chime", "bell", "pop"].includes(settings.sound)
      ) {
        throw new Error("Invalid sound settings");
      }

      // Update user settings
      userSoundSettings[socket.username] = settings;

      // Confirm update to user
      socket.emit("soundSettingsUpdated", settings);
    } catch (error) {
      console.error("Sound settings error:", error);
      socket.emit("error", error.message);
    }
  });

  // Handle AI requests
  // socket.on("aiRequest", async (prompt, callback) => {
  //   try {
  //     if (!socket.username || !socket.room) {
  //       throw new Error("You must be in a room to use AI");
  //     }

  //     // Get last 5 messages for context (excluding system messages)
  //     const context = chatRooms[socket.room]?.messages
  //       .filter((msg) => !msg.isSystem)
  //       .slice(-5)
  //       .map((msg) => ({
  //         username: msg.username,
  //         text: msg.text,
  //       }));

  //     const aiResponse = await AIService.generateResponse(prompt, context);

  //     const message = {
  //       id: uuidv4(),
  //       username: "AI",
  //       text: aiResponse,
  //       time: new Date().toLocaleTimeString(),
  //       isSystem: false,
  //     };

  //     chatRooms[socket.room].messages.push(message);
  //     io.to(socket.room).emit("message", message);

  //     // Callback to handle client-side response
  //     if (typeof callback === "function") {
  //       callback({ success: true });
  //     }
  //   } catch (error) {
  //     console.error("AI request error:", error);
  //     if (typeof callback === "function") {
  //       callback({ error: error.message });
  //     } else {
  //       socket.emit("error", error.message);
  //     }
  //   }
  // });

  // Handle AI requests
  socket.on("aiRequest", async (prompt, callback) => {
    try {
      if (!socket.username || !socket.room) {
        throw new Error("You must be in a room to use AI");
      }

      // Get last 5 messages for context (excluding system messages)
      const context = chatRooms[socket.room]?.messages
        .filter((msg) => !msg.isSystem)
        .slice(-5)
        .map((msg) => ({
          username: msg.username,
          text: msg.text,
        }));

      const aiResponse = await AIService.generateResponse(prompt, context);

      const message = {
        id: uuidv4(),
        username: "AI",
        text: aiResponse,
        time: new Date().toLocaleTimeString(),
        isSystem: false,
      };

      // chatRooms[socket.room].messages.push(message);

      // // Send AI message ONLY to the requesting user
      socket.emit("message", message);

      // Callback to handle client-side response
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      console.error("AI request error:", error);
      if (typeof callback === "function") {
        callback({ error: error.message });
      } else {
        socket.emit("error", error.message);
      }
    }
  });

  socket.on("typing", (data) => {
    try {
      if (typeof data.isTyping !== "boolean") return;

      const user = chatRooms[socket.room]?.users.find(
        (u) => u.id === socket.id
      );
      if (!user || !socket.room) return;

      // Broadcast to everyone in the room except the sender
      socket.broadcast.to(socket.room).emit("typing", {
        username: user.username,
        isTyping: data.isTyping,
      });
    } catch (error) {
      console.error("Typing indicator error:", error);
    }
  });

  // Handle reactions
  socket.on("react", ({ messageId, reaction }) => {
    try {
      const room = chatRooms[socket.room];
      if (!room) throw new Error("Room not found");

      const message = room.messages.find((m) => m.id === messageId);
      if (!message) throw new Error("Message not found");

      if (!message.reactions) {
        message.reactions = {};
      }

      if (!message.reactions[reaction]) {
        message.reactions[reaction] = 0;
      }
      message.reactions[reaction] += 1;

      io.to(socket.room).emit("reaction", {
        messageId,
        reaction,
        count: message.reactions[reaction],
      });
    } catch (error) {
      console.error("Reaction error:", error);
      socket.emit("error", error.message);
    }
  });

  // Handle message editing
  socket.on("editMessage", ({ id, text }) => {
    try {
      const room = chatRooms[socket.room];
      if (!room) return; // Silently return if room not found

      const message = room.messages.find((m) => m.id === id);
      if (!message) return; // Silently return if message not found

      if (message.username !== socket.username) return; // Silently return if not owner

      const cleanText = sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: {},
      });

      message.text = cleanText;
      message.edited = true;
      io.to(socket.room).emit("messageEdited", { id, text: cleanText });
    } catch (error) {
      console.error("Edit message error:", error);
      // Don't send error to client
    }
  });

  // Handle message deletion
  socket.on("deleteMessage", (messageId) => {
    try {
      const room = chatRooms[socket.room];
      if (!room) return; // Silently return if room not found

      const messageIndex = room.messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return; // Silently return if message not found

      if (room.messages[messageIndex].username !== socket.username) return; // Silently return if not owner

      room.messages.splice(messageIndex, 1);
      io.to(socket.room).emit("messageDeleted", messageId);
    } catch (error) {
      console.error("Delete message error:", error);
      // Don't send error to client
    }
  });

  // Handle message pinning
  socket.on("pinMessage", (messageId) => {
    try {
      const room = chatRooms[socket.room];
      if (!room) throw new Error("Room not found");

      const message = room.messages.find((m) => m.id === messageId);
      if (!message) throw new Error("Message not found");

      if (room.pinnedMessages.some((m) => m.id === messageId)) {
        throw new Error("Message is already pinned");
      }

      const pinnedMessage = {
        ...message,
        pinnedBy: socket.username,
        pinnedAt: new Date().toLocaleTimeString(),
      };
      room.pinnedMessages.push(pinnedMessage);
      io.to(socket.room).emit("pinnedMessage", pinnedMessage);
    } catch (error) {
      console.error("Pin message error:", error);
      socket.emit("error", error.message);
    }
  });

  // Handle “clear history” requests
  socket.on("clearHistory", () => {
    const room = socket.room;
    if (!room || !chatRooms[room]) return;

    // Wipe out both message lists
    chatRooms[room].messages = [];
    chatRooms[room].pinnedMessages = [];

    // Notify everyone (optional)
    const systemMsg = {
      id: uuidv4(),
      username: "ChatBot",
      text: `🚮 Chat history was cleared by ${socket.username}`,
      time: new Date().toLocaleTimeString(),
      isSystem: true,
    };
    io.to(room).emit("message", systemMsg);
  });

  // Handle read receipts
  socket.on("messageRead", (messageId) => {
    try {
      const room = chatRooms[socket.room];
      if (!room) throw new Error("Room not found");

      const message = room.messages.find((m) => m.id === messageId);
      if (!message) throw new Error("Message not found");

      if (!message.readBy) {
        message.readBy = [];
      }

      if (!message.readBy.includes(socket.username)) {
        message.readBy.push(socket.username);
        io.to(socket.room).emit("messageReadBy", {
          messageId,
          username: socket.username,
        });
      }
    } catch (error) {
      console.error("Read receipt error:", error);
      socket.emit("error", error.message);
    }
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    try {
      if (socket.username && socket.room && chatRooms[socket.room]) {
        // Remove user from room
        chatRooms[socket.room].users = chatRooms[socket.room].users.filter(
          (user) => user.username !== socket.username
        );

        // Broadcast user left
        const leaveMessage = {
          id: uuidv4(),
          username: "ChatBot",
          text: `${socket.username} has left the chat`,
          time: new Date().toLocaleTimeString(),
          isSystem: true,
        };
        io.to(socket.room).emit("message", leaveMessage);
        chatRooms[socket.room].messages.push(leaveMessage);

        // Update user list
        updateUserList(socket.room);
      }
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });

  // Helper function to update user list for all in room
  function updateUserList(room) {
    try {
      if (chatRooms[room]) {
        io.to(room).emit(
          "userList",
          chatRooms[room].users.map((u) => ({
            username: u.username,
            lastSeen: u.lastSeen,
          }))
        );
      }
    } catch (error) {
      console.error("Update user list error:", error);
    }
  }
});

// Handle image uploads
app.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ imageUrl: `/images/${req.file.filename}` });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});
