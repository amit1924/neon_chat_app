// const express = require("express");
// const socketio = require("socket.io");
// const multer = require("multer");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "public/images");
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `${uuidv4()}${ext}`);
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
//   fileFilter: (req, file, cb) => {
//     const filetypes = /jpeg|jpg|png|gif/;
//     const extname = filetypes.test(
//       path.extname(file.originalname).toLowerCase()
//     );
//     const mimetype = filetypes.test(file.mimetype);
//     if (extname && mimetype) {
//       return cb(null, true);
//     } else {
//       cb("Error: Images only (JPEG, JPG, PNG, GIF)");
//     }
//   },
// }).single("image");

// // Middleware
// app.use(express.static(path.join(__dirname, "public")));

// // Routes
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public/index.html"));
// });

// app.get("/chat", (req, res) => {
//   res.sendFile(path.join(__dirname, "public/chat.html"));
// });

// // Start server
// const server = app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// // Socket.io setup
// const io = socketio(server);

// io.on("connection", (socket) => {
//   console.log("New user connected");

//   // Join room
//   socket.on("joinRoom", ({ username, room }) => {
//     socket.join(room);

//     // Welcome current user
//     socket.emit("message", {
//       username: "ChatBot",
//       text: `Welcome to the chat, ${username}!`,
//       time: new Date().toLocaleTimeString(),
//       isSystem: true,
//     });

//     // Broadcast when a user connects
//     socket.broadcast.to(room).emit("message", {
//       username: "ChatBot",
//       text: `${username} has joined the chat`,
//       time: new Date().toLocaleTimeString(),
//       isSystem: true,
//     });

//     // Store user data
//     socket.username = username;
//     socket.room = room;
//   });

//   // Listen for chat messages
//   socket.on("chatMessage", (msg) => {
//     io.to(socket.room).emit("message", {
//       username: socket.username,
//       text: msg.text,
//       image: msg.image,
//       time: new Date().toLocaleTimeString(),
//       isSystem: false,
//     });
//   });

//   // Listen for typing events
//   socket.on("typing", (isTyping) => {
//     socket.broadcast.to(socket.room).emit("typing", {
//       username: socket.username,
//       isTyping,
//     });
//   });

//   // Runs when client disconnects
//   socket.on("disconnect", () => {
//     if (socket.username) {
//       io.to(socket.room).emit("message", {
//         username: "ChatBot",
//         text: `${socket.username} has left the chat`,
//         time: new Date().toLocaleTimeString(),
//         isSystem: true,
//       });
//     }
//   });
// });

// // Handle image uploads
// app.post("/upload", (req, res) => {
//   upload(req, res, (err) => {
//     if (err) {
//       return res.status(400).json({ error: err });
//     }
//     if (!req.file) {
//       return res.status(400).json({ error: "No file uploaded" });
//     }
//     res.json({ imageUrl: `/images/${req.file.filename}` });
//   });
// });

const express = require("express");
const socketio = require("socket.io");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sanitizeHtml = require("sanitize-html");

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for messages and users
const chatRooms = {}; // Structure: { roomName: { messages: [], users: [], pinnedMessages: [] } }
const messageRateLimits = {};

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
        socket.emit("message", msg);
      });

      // Send pinned messages
      chatRooms[room].pinnedMessages.forEach((msg) => {
        socket.emit("pinnedMessage", msg);
      });

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

      // Validate and sanitize message
      if (!msg || typeof msg.text !== "string") {
        throw new Error("Invalid message format");
      }

      const cleanText = sanitizeHtml(msg.text, {
        allowedTags: [],
        allowedAttributes: {},
      });

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
      io.to(socket.room).emit("message", message);
    } catch (error) {
      console.error("Chat message error:", error);
      socket.emit("error", error.message);
    }
  });

  // Listen for typing events
  socket.on("typing", (isTyping) => {
    if (typeof isTyping !== "boolean") return;

    socket.broadcast.to(socket.room).emit("typing", {
      username: socket.username,
      isTyping,
    });
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
      if (!room) throw new Error("Room not found");

      const message = room.messages.find((m) => m.id === id);
      if (!message) throw new Error("Message not found");

      if (message.username !== socket.username) {
        throw new Error("You can only edit your own messages");
      }

      const cleanText = sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: {},
      });

      message.text = cleanText;
      message.edited = true;
      io.to(socket.room).emit("messageEdited", { id, text: cleanText });
    } catch (error) {
      console.error("Edit message error:", error);
      socket.emit("error", error.message);
    }
  });

  // Handle message deletion
  socket.on("deleteMessage", (messageId) => {
    try {
      const room = chatRooms[socket.room];
      if (!room) throw new Error("Room not found");

      const messageIndex = room.messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) throw new Error("Message not found");

      if (room.messages[messageIndex].username !== socket.username) {
        throw new Error("You can only delete your own messages");
      }

      room.messages.splice(messageIndex, 1);
      io.to(socket.room).emit("messageDeleted", messageId);
    } catch (error) {
      console.error("Delete message error:", error);
      socket.emit("error", error.message);
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
