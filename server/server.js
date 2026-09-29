const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const groupRoutes = require("./routes/groupRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const User = require("./models/User");

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://realtime-chat-app-client-phwr.onrender.com"
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/", (req, res) => {
    res.json({ message: "Realtime Chat API is running" });
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(error => console.error("❌ MongoDB connection error:", error));

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("user-online", async (userId) => {
        try {
            if (!userId) return;

            await User.findByIdAndUpdate(userId, {
                isOnline: true,
                lastSeen: new Date()
            });

            io.emit("user-online", userId);
            console.log("🟢 User online:", userId);
        } catch (error) {
            console.error("❌ Error updating online status:", error);
        }
    });

    socket.on("user-offline", async (userId) => {
        try {
            if (!userId) return;

            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastSeen: new Date()
            });

            io.emit("user-offline", userId);
            console.log("🔴 User offline:", userId);
        } catch (error) {
            console.error("❌ Error updating offline status:", error);
        }
    });

    socket.on("join-room", (roomId) => {
        if (!roomId) return;

        socket.join(roomId);
        console.log(`👥 User ${socket.id} joined room: ${roomId}`);
    });

    socket.on("send-message", (message) => {
        try {
            if (!message || !message.roomId) return;

            socket.to(message.roomId).emit("receive-message", message);
            console.log(`💬 Message sent to room: ${message.roomId}`);
        } catch (error) {
            console.error("❌ Error sending message:", error);
        }
    });

    socket.on("send-group-message", (message) => {
        try {
            if (!message || !message.groupId) return;

            socket.to(message.groupId).emit("receive-group-message", message);
            console.log(`👥 Group message sent to: ${message.groupId}`);
        } catch (error) {
            console.error("❌ Error sending group message:", error);
        }
    });

    socket.on("join-group", (groupId) => {
        if (!groupId) return;

        socket.join(groupId);
        console.log(`👥 User ${socket.id} joined group: ${groupId}`);
    });

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});