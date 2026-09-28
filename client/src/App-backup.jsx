import {
    SignedIn,
    SignedOut,
    SignIn,
    SignUp,
    UserButton,
    useUser,
} from "@clerk/clerk-react";

import {
    useEffect,
    useState,
    useRef,
} from "react";

import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

const API_URL = "http://127.0.0.1:5000";


// =====================================================
// SYNC CLERK USER WITH MONGODB
// =====================================================

function UserSync() {
    const { user } = useUser();

    useEffect(() => {
        if (!user) return;

        const syncUser = async () => {
            try {
                const response = await axios.post(
                    `${API_URL}/api/users/sync`,
                    {
                        clerkId: user.id,

                        username:
                            user.username ||
                            user.firstName ||
                            user.primaryEmailAddress?.emailAddress ||
                            "User",

                        email:
                            user.primaryEmailAddress?.emailAddress ||
                            "",

                        profileImage:
                            user.imageUrl || "",
                    }
                );

                console.log(
                    "✅ User synced with MongoDB:",
                    response.data
                );
            } catch (error) {
                console.error(
                    "❌ User sync failed:",
                    error.response?.data ||
                    error.message
                );
            }
        };

        syncUser();
    }, [user]);

    return null;
}


// =====================================================
// CHAT APPLICATION
// =====================================================

function ChatApp() {

    const { user } = useUser();

    // Users
    const [users, setUsers] = useState([]);

    // Selected chat user
    const [selectedUser, setSelectedUser] =
        useState(null);

    // Messages
    const [messages, setMessages] =
        useState([]);

    // Input
    const [messageText, setMessageText] =
        useState("");

    // Loading states
    const [loadingUsers, setLoadingUsers] =
        useState(true);

    const [loadingMessages, setLoadingMessages] =
        useState(false);

    // Current MongoDB user
    const [currentUser, setCurrentUser] =
        useState(null);

    // Socket reference
    const socketRef = useRef(null);


    // =================================================
    // CONNECT SOCKET.IO
    // =================================================

    useEffect(() => {

        if (!user) return;

        console.log("🔌 Connecting to Socket.IO...");

        socketRef.current = io(API_URL);

        socketRef.current.on("connect", () => {
            console.log(
                "✅ Socket connected:",
                socketRef.current.id
            );
        });

        socketRef.current.on("disconnect", () => {
            console.log(
                "🔴 Socket disconnected"
            );
        });

        return () => {

            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }

        };

    }, [user]);


    // =================================================
    // GET ALL USERS
    // =================================================

    useEffect(() => {

        const fetchUsers = async () => {

            if (!user) return;

            try {

                const response = await axios.get(
                    `${API_URL}/api/users`
                );

                const otherUsers =
                    response.data.filter(
                        (item) =>
                            item.clerkId !== user.id
                    );

                setUsers(otherUsers);

            } catch (error) {

                console.error(
                    "❌ Failed to fetch users:",
                    error.response?.data ||
                    error.message
                );

            } finally {

                setLoadingUsers(false);

            }
        };

        fetchUsers();

    }, [user]);


    // =================================================
    // GET CURRENT MONGODB USER
    // =================================================

    useEffect(() => {

        const getCurrentUser = async () => {

            if (!user) return;

            try {

                const response =
                    await axios.get(
                        `${API_URL}/api/users`
                    );

                const mongoUser =
                    response.data.find(
                        (item) =>
                            item.clerkId === user.id
                    );

                if (!mongoUser) {

                    console.error(
                        "❌ Current user not found in MongoDB"
                    );

                    return;
                }

                console.log(
                    "👤 Current MongoDB user:",
                    mongoUser
                );

                setCurrentUser(mongoUser);

            } catch (error) {

                console.error(
                    "❌ Failed to get current user:",
                    error.response?.data ||
                    error.message
                );

            }
        };

        getCurrentUser();

    }, [user]);


    // =================================================
    // TELL SOCKET.IO THAT USER IS ONLINE
    // =================================================

    useEffect(() => {

        if (
            !currentUser ||
            !socketRef.current
        ) {
            return;
        }

        console.log(
            "🟢 Sending user-online:",
            currentUser._id
        );

        socketRef.current.emit(
            "user-online",
            currentUser._id
        );

    }, [currentUser]);


    // =================================================
    // GET PREVIOUS MESSAGES
    // =================================================

    useEffect(() => {

        const fetchMessages = async () => {

            if (
                !selectedUser ||
                !currentUser
            ) {
                return;
            }

            setLoadingMessages(true);

            try {

                const response =
                    await axios.get(
                        `${API_URL}/api/messages/private/${currentUser._id}/${selectedUser._id}`
                    );

                setMessages(response.data);

            } catch (error) {

                console.error(
                    "❌ Failed to fetch messages:",
                    error.response?.data ||
                    error.message
                );

                setMessages([]);

            } finally {

                setLoadingMessages(false);

            }
        };

        fetchMessages();

    }, [selectedUser, currentUser]);


    // =================================================
    // JOIN PRIVATE CHAT ROOM
    // =================================================

    useEffect(() => {

        if (
            !selectedUser ||
            !currentUser ||
            !socketRef.current
        ) {
            return;
        }

        console.log(
            "💬 Joining private chat..."
        );

        socketRef.current.emit(
            "join-private-chat",
            {
                userId: currentUser._id,

                otherUserId:
                    selectedUser._id,
            }
        );

    }, [selectedUser, currentUser]);


    // =================================================
    // RECEIVE REAL-TIME MESSAGE
    // =================================================

    useEffect(() => {

        if (!socketRef.current) {
            return;
        }

        const receiveMessage =
            (message) => {

                console.log(
                    "📨 Received message:",
                    message
                );

                // Only add the message if it belongs
                // to the currently open conversation

                if (
                    !currentUser ||
                    !selectedUser
                ) {
                    return;
                }

                const isCurrentConversation =
                    (
                        message.senderId ===
                            currentUser._id &&
                        message.receiverId ===
                            selectedUser._id
                    ) ||
                    (
                        message.senderId ===
                            selectedUser._id &&
                        message.receiverId ===
                            currentUser._id
                    );

                if (
                    isCurrentConversation
                ) {

                    setMessages(
                        (previousMessages) => {

                            // Avoid duplicate message
                            if (
                                previousMessages.some(
                                    (item) =>
                                        item._id ===
                                        message._id
                                )
                            ) {
                                return previousMessages;
                            }

                            return [
                                ...previousMessages,
                                message,
                            ];
                        }
                    );

                }

            };


        socketRef.current.on(
            "receive-private-message",
            receiveMessage
        );


        return () => {

            socketRef.current?.off(
                "receive-private-message",
                receiveMessage
            );

        };

    }, [
        currentUser,
        selectedUser,
    ]);


    // =================================================
    // SEND MESSAGE
    // =================================================

    const sendMessage = async () => {

        if (
            !messageText.trim() ||
            !selectedUser ||
            !currentUser
        ) {
            return;
        }

        try {

            // Save message in MongoDB

            const response =
                await axios.post(
                    `${API_URL}/api/messages/private`,
                    {
                        senderId:
                            currentUser._id,

                        receiverId:
                            selectedUser._id,

                        text:
                            messageText,

                        messageType:
                            "text",
                    }
                );


            const savedMessage =
                response.data;


            // Show message immediately
            setMessages(
                (previousMessages) => {

                    if (
                        previousMessages.some(
                            (item) =>
                                item._id ===
                                savedMessage._id
                        )
                    ) {
                        return previousMessages;
                    }

                    return [
                        ...previousMessages,
                        savedMessage,
                    ];
                }
            );


            // Send through Socket.IO

            socketRef.current?.emit(
                "send-private-message",
                {
                    senderId:
                        currentUser._id,

                    receiverId:
                        selectedUser._id,

                    text:
                        savedMessage.text,

                    messageType:
                        savedMessage.messageType,

                    _id:
                        savedMessage._id,

                    createdAt:
                        savedMessage.createdAt,

                    sender:
                        savedMessage.sender,

                    receiver:
                        savedMessage.receiver,
                }
            );


            // Clear input

            setMessageText("");

        } catch (error) {

            console.error(
                "❌ Failed to send message:",
                error.response?.data ||
                error.message
            );

        }
    };


    // =================================================
    // ENTER KEY SEND
    // =================================================

    const handleKeyDown =
        (event) => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendMessage();

            }

        };


    // =================================================
    // UI
    // =================================================

    return (

        <div className="chat-app">


            {/* =========================================
                SIDEBAR
            ========================================= */}

            <aside className="sidebar">


                {/* HEADER */}

                <div className="sidebar-header">

                    <div>

                        <h2>
                            💬 Chat App
                        </h2>

                        <p>
                            {
                                user?.firstName ||
                                user?.username ||
                                "User"
                            }
                        </p>

                    </div>

                    <UserButton />

                </div>


                {/* SEARCH */}

                <div className="search-box">

                    <input
                        type="text"
                        placeholder="🔍 Search users..."
                    />

                </div>


                {/* USERS */}

                <div className="users-section">

                    <h3>
                        Users
                    </h3>


                    {loadingUsers ? (

                        <p className="info-text">
                            Loading users...
                        </p>

                    ) : users.length === 0 ? (

                        <p className="info-text">
                            No other users yet.
                        </p>

                    ) : (

                        users.map(
                            (item) => (

                                <div
                                    key={item._id}
                                    className={`user-item ${
                                        selectedUser?._id ===
                                        item._id
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setSelectedUser(
                                            item
                                        )
                                    }
                                >

                                    <img
                                        src={
                                            item.profileImage ||
                                            "https://via.placeholder.com/45"
                                        }
                                        alt={
                                            item.username
                                        }
                                    />


                                    <div className="user-info">

                                        <strong>
                                            {
                                                item.username
                                            }
                                        </strong>


                                        <span>

                                            <span
                                                className={
                                                    item.isOnline
                                                        ? "online-dot"
                                                        : "offline-dot"
                                                }
                                            ></span>

                                            {
                                                item.isOnline
                                                    ? "Online"
                                                    : "Offline"
                                            }

                                        </span>

                                    </div>

                                </div>

                            )
                        )

                    )}

                </div>

            </aside>


            {/* =========================================
                CHAT AREA
            ========================================= */}

            <main className="chat-area">


                {/* NO USER SELECTED */}

                {!selectedUser ? (

                    <div className="welcome-screen">

                        <div className="welcome-icon">
                            💬
                        </div>

                        <h1>
                            Welcome to Real-Time Chat
                        </h1>

                        <p>
                            Select a user from the
                            left to start chatting.
                        </p>

                    </div>

                ) : (

                    <>


                        {/* =============================
                            CHAT HEADER
                        ============================= */}

                        <div className="chat-header">

                            <img
                                src={
                                    selectedUser.profileImage ||
                                    "https://via.placeholder.com/45"
                                }
                                alt={
                                    selectedUser.username
                                }
                            />


                            <div>

                                <h3>
                                    {
                                        selectedUser.username
                                    }
                                </h3>

                                <span>

                                    <span
                                        className={
                                            selectedUser.isOnline
                                                ? "online-dot"
                                                : "offline-dot"
                                        }
                                    ></span>

                                    {
                                        selectedUser.isOnline
                                            ? "Online"
                                            : "Offline"
                                    }

                                </span>

                            </div>

                        </div>


                        {/* =============================
                            MESSAGES
                        ============================= */}

                        <div className="messages-area">


                            {loadingMessages ? (

                                <div className="empty-chat">

                                    <p>
                                        Loading messages...
                                    </p>

                                </div>

                            ) : messages.length === 0 ? (

                                <div className="empty-chat">

                                    <p>

                                        👋 Start a
                                        conversation
                                        with{" "}

                                        <strong>
                                            {
                                                selectedUser.username
                                            }
                                        </strong>

                                    </p>

                                </div>

                            ) : (

                                messages.map(
                                    (message) => {

                                        const isMyMessage =
                                            message.sender?._id ===
                                                currentUser?._id ||
                                            message.senderId ===
                                                currentUser?._id;


                                        return (

                                            <div
                                                key={
                                                    message._id
                                                }
                                                style={{
                                                    display:
                                                        "flex",

                                                    justifyContent:
                                                        isMyMessage
                                                            ? "flex-end"
                                                            : "flex-start",

                                                    marginBottom:
                                                        "10px",
                                                }}
                                            >

                                                <div
                                                    style={{
                                                        background:
                                                            isMyMessage
                                                                ? "#2563eb"
                                                                : "#e5e7eb",

                                                        color:
                                                            isMyMessage
                                                                ? "white"
                                                                : "#111",

                                                        padding:
                                                            "10px 14px",

                                                        borderRadius:
                                                            "12px",

                                                        maxWidth:
                                                            "60%",

                                                        wordBreak:
                                                            "break-word",
                                                    }}
                                                >

                                                    {
                                                        message.text
                                                    }

                                                </div>

                                            </div>

                                        );

                                    }
                                )

                            )}

                        </div>


                        {/* =============================
                            MESSAGE INPUT
                        ============================= */}

                        <div className="message-input-area">


                            <button
                                className="attachment-button"
                            >
                                📎
                            </button>


                            <input
                                type="text"
                                placeholder="Type a message..."
                                value={
                                    messageText
                                }
                                onChange={
                                    (event) =>
                                        setMessageText(
                                            event.target.value
                                        )
                                }
                                onKeyDown={
                                    handleKeyDown
                                }
                            />


                            <button
                                className="send-button"
                                onClick={
                                    sendMessage
                                }
                            >
                                Send
                            </button>

                        </div>

                    </>

                )}

            </main>

        </div>

    );
}


// =====================================================
// MAIN APP
// =====================================================

function App() {

    return (

        <>

            <SignedOut>

                <div className="auth-container">

                    <h1>
                        💬 Real-Time Chat App
                    </h1>

                    <div className="auth-box">

                        <SignIn />

                        <SignUp />

                    </div>

                </div>

            </SignedOut>


            <SignedIn>

                <UserSync />

                <ChatApp />

            </SignedIn>

        </>

    );

}

export default App;