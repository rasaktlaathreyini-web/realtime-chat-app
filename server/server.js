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


// =====================================================
// HTTP SERVER
// =====================================================

const httpServer = http.createServer(app);


// =====================================================
// SOCKET.IO
// =====================================================

const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        methods: ["GET", "POST"],
    },
});


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
    })
);

app.use(express.json());


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);


// =====================================================
// ROUTES
// =====================================================

app.use(
    "/api/users",
    userRoutes
);

app.use(
    "/api/messages",
    messageRoutes
);

app.use(
    "/api/groups",
    groupRoutes
);

app.use(
    "/api/uploads",
    uploadRoutes
);


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {

    res.json({
        message:
            "Real-Time Chat Server is running!",
    });

});


// =====================================================
// ONLINE USERS
// =====================================================

const onlineUsers = new Map();


// =====================================================
// SOCKET.IO CONNECTION
// =====================================================

io.on("connection", (socket) => {

    console.log(
        "🔌 User connected:",
        socket.id
    );


    // =================================================
    // USER ONLINE
    // =================================================

    socket.on(
        "user-online",
        async (userId) => {

            try {

                onlineUsers.set(
                    userId,
                    socket.id
                );

                await User.findByIdAndUpdate(
                    userId,
                    {
                        isOnline: true,
                        lastSeen: new Date(),
                    }
                );

                console.log(
                    "🟢 User online:",
                    userId
                );

                io.emit(
                    "online-users",
                    Array.from(
                        onlineUsers.keys()
                    )
                );

            } catch (error) {

                console.error(
                    "❌ Online status error:",
                    error.message
                );

            }

        }
    );


    // =================================================
    // PRIVATE CHAT ROOM
    // =================================================

    socket.on(
        "join-private-chat",
        ({
            userId,
            otherUserId,
        }) => {

            const roomId = [
                userId,
                otherUserId,
            ]
                .sort()
                .join("-");

            socket.join(roomId);

            console.log(
                `💬 Joined private room: ${roomId}`
            );

        }
    );


    // =================================================
    // PRIVATE MESSAGE
    // =================================================

    socket.on(
        "send-private-message",
        (message) => {

            const roomId = [
                message.senderId,
                message.receiverId,
            ]
                .sort()
                .join("-");

            console.log(
                "📨 Private message:",
                roomId
            );

            io.to(roomId).emit(
                "receive-private-message",
                message
            );

        }
    );


    // =================================================
    // GROUP ROOM
    // =================================================

    socket.on(
        "join-group",
        (groupId) => {

            const roomId =
                `group-${groupId}`;

            socket.join(roomId);

            console.log(
                `👥 Joined group room: ${roomId}`
            );

        }
    );


    // =================================================
    // GROUP MESSAGE
    // =================================================

    socket.on(
        "send-group-message",
        (message) => {

            const roomId =
                `group-${message.group}`;

            console.log(
                "📨 Group message:",
                roomId
            );

            io.to(roomId).emit(
                "receive-group-message",
                message
            );

        }
    );


    // =================================================
    // DISCONNECT
    // =================================================

    socket.on(
        "disconnect",
        async () => {

            console.log(
                "🔴 User disconnected:",
                socket.id
            );

            let disconnectedUser = null;

            for (
                const [
                    userId,
                    socketId,
                ] of onlineUsers.entries()
            ) {

                if (
                    socketId === socket.id
                ) {

                    disconnectedUser =
                        userId;

                    break;

                }

            }


            if (!disconnectedUser) {
                return;
            }


            onlineUsers.delete(
                disconnectedUser
            );


            try {

                await User.findByIdAndUpdate(
                    disconnectedUser,
                    {
                        isOnline: false,
                        lastSeen: new Date(),
                    }
                );

                console.log(
                    "⚪ User offline:",
                    disconnectedUser
                );

                io.emit(
                    "online-users",
                    Array.from(
                        onlineUsers.keys()
                    )
                );

            } catch (error) {

                console.error(
                    "❌ Offline status error:",
                    error.message
                );

            }

        }
    );

});


// =====================================================
// MONGODB
// =====================================================

mongoose
    .connect(
        process.env.MONGODB_URI
    )
    .then(() => {

        console.log(
            "✅ MongoDB connected"
        );

        httpServer.listen(
            process.env.PORT || 5000,
            () => {

                console.log(
                    `🚀 Server running on http://localhost:${process.env.PORT || 5000}`
                );

            }
        );

    })
    .catch((error) => {

        console.error(
            "❌ MongoDB connection failed:"
        );

        console.error(
            error.message
        );

    });