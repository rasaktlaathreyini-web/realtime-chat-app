import {
    SignedIn,
    SignedOut,
    SignIn,
    UserButton,
    useUser,
} from "@clerk/clerk-react";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

const API_URL = "http://127.0.0.1:5000";

// =====================================================
// HELPERS
// =====================================================

const formatTime = (date) => {
    if (!date) return "";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    return parsedDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getInitials = (name = "User") => {
    return name
        .split(" ")
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
};

// =====================================================
// CHAT APPLICATION
// =====================================================

function ChatApp() {
    const { user } = useUser();

    // USERS
    const [users, setUsers] = useState([]);
    const [searchText, setSearchText] = useState("");

    // GROUPS
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [showGroupMembers, setShowGroupMembers] = useState(false);

    // PRIVATE USER
    const [selectedUser, setSelectedUser] = useState(null);

    // MESSAGES
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");

    // CURRENT USER
    const [currentUser, setCurrentUser] = useState(null);

    // LOADING
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // THEME
    const [darkMode, setDarkMode] = useState(true);

    // SOCKET
    const socketRef = useRef(null);
    const currentUserRef = useRef(null);

    // =================================================
    // CURRENT USER REF
    // =================================================

    useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser]);

    // =================================================
    // SYNC CLERK USER
    // =================================================

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
                            user.primaryEmailAddress?.emailAddress || "",
                        profileImage: user.imageUrl || "",
                    }
                );

                setCurrentUser(response.data);

                console.log("✅ User synced:", response.data);
            } catch (error) {
                console.error(
                    "❌ User sync failed:",
                    error.response?.data || error.message
                );
            }
        };

        syncUser();
    }, [user]);

    // =================================================
    // CONNECT SOCKET
    // =================================================

    useEffect(() => {
        if (!user) return;

        console.log("🔌 Connecting Socket.IO...");

        const socket = io(API_URL);

        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("✅ Socket connected:", socket.id);

            const mongoUser = currentUserRef.current;

            if (mongoUser) {
                socket.emit("user-online", mongoUser._id);
            }
        });

        socket.on("disconnect", () => {
            console.log("🔴 Socket disconnected");
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user]);

    // =================================================
    // SEND USER ONLINE
    // =================================================

    useEffect(() => {
        if (!currentUser || !socketRef.current) return;

        if (socketRef.current.connected) {
            socketRef.current.emit(
                "user-online",
                currentUser._id
            );
        }
    }, [currentUser]);

    // =================================================
    // FETCH USERS
    // =================================================

    useEffect(() => {
        const fetchUsers = async () => {
            if (!currentUser) return;

            try {
                const response = await axios.get(
                    `${API_URL}/api/users`
                );

                const otherUsers = response.data.filter(
                    (item) => item._id !== currentUser._id
                );

                setUsers(otherUsers);
            } catch (error) {
                console.error(
                    "❌ Failed to fetch users:",
                    error.response?.data || error.message
                );
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchUsers();
    }, [currentUser]);

    // =================================================
    // FETCH GROUPS
    // =================================================

    useEffect(() => {
        const fetchGroups = async () => {
            if (!currentUser) return;

            try {
                const response = await axios.get(
                    `${API_URL}/api/groups/user/${currentUser._id}`
                );

                setGroups(response.data);
            } catch (error) {
                console.error(
                    "❌ Failed to fetch groups:",
                    error.response?.data || error.message
                );
            }
        };

        fetchGroups();
    }, [currentUser]);

    // =================================================
    // ONLINE USERS
    // =================================================

    useEffect(() => {
        const socket = socketRef.current;

        if (!socket) return;

        const updateOnlineUsers = (onlineUserIds) => {
            setUsers((previousUsers) =>
                previousUsers.map((item) => ({
                    ...item,
                    isOnline: onlineUserIds.includes(item._id),
                }))
            );

            setSelectedUser((previous) => {
                if (!previous) return previous;

                return {
                    ...previous,
                    isOnline: onlineUserIds.includes(
                        previous._id
                    ),
                };
            });

            setGroups((previousGroups) =>
                previousGroups.map((group) => ({
                    ...group,
                    members: group.members.map((member) => ({
                        ...member,
                        isOnline: onlineUserIds.includes(
                            member._id
                        ),
                    })),
                }))
            );
        };

        socket.on("online-users", updateOnlineUsers);

        return () => {
            socket.off(
                "online-users",
                updateOnlineUsers
            );
        };
    }, [currentUser]);

    // =================================================
    // FETCH PRIVATE MESSAGES
    // =================================================

    useEffect(() => {
        const fetchMessages = async () => {
            if (!selectedUser || !currentUser) return;

            setLoadingMessages(true);

            try {
                const response = await axios.get(
                    `${API_URL}/api/messages/private/${currentUser._id}/${selectedUser._id}`
                );

                setMessages(response.data);
            } catch (error) {
                console.error(
                    "❌ Failed to fetch messages:",
                    error.response?.data || error.message
                );

                setMessages([]);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();
    }, [selectedUser, currentUser]);

    // =================================================
    // FETCH GROUP MESSAGES
    // =================================================

    useEffect(() => {
        const fetchGroupMessages = async () => {
            if (!selectedGroup) return;

            setLoadingMessages(true);

            try {
                const response = await axios.get(
                    `${API_URL}/api/groups/${selectedGroup._id}/messages`
                );

                setMessages(response.data);
            } catch (error) {
                console.error(
                    "❌ Failed to fetch group messages:",
                    error.response?.data || error.message
                );

                setMessages([]);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchGroupMessages();
    }, [selectedGroup]);

    // =================================================
    // JOIN PRIVATE ROOM
    // =================================================

    useEffect(() => {
        if (
            !selectedUser ||
            !currentUser ||
            !socketRef.current
        ) {
            return;
        }

        socketRef.current.emit(
            "join-private-chat",
            {
                userId: currentUser._id,
                otherUserId: selectedUser._id,
            }
        );
    }, [selectedUser, currentUser]);

    // =================================================
    // JOIN GROUP ROOM
    // =================================================

    useEffect(() => {
        if (!selectedGroup || !socketRef.current) {
            return;
        }

        socketRef.current.emit(
            "join-group",
            selectedGroup._id
        );
    }, [selectedGroup]);

    // =================================================
    // RECEIVE PRIVATE MESSAGE
    // =================================================

    useEffect(() => {
        const socket = socketRef.current;

        if (!socket) return;

        const receiveMessage = (message) => {
            if (!currentUser || !selectedUser) return;

            const isCurrentConversation =
                (
                    message.senderId === currentUser._id &&
                    message.receiverId === selectedUser._id
                ) ||
                (
                    message.senderId === selectedUser._id &&
                    message.receiverId === currentUser._id
                );

            if (!isCurrentConversation) return;

            setMessages((previous) => {
                if (
                    previous.some(
                        (item) => item._id === message._id
                    )
                ) {
                    return previous;
                }

                return [...previous, message];
            });
        };

        socket.on(
            "receive-private-message",
            receiveMessage
        );

        return () => {
            socket.off(
                "receive-private-message",
                receiveMessage
            );
        };
    }, [currentUser, selectedUser]);

    // =================================================
    // RECEIVE GROUP MESSAGE
    // =================================================

    useEffect(() => {
        const socket = socketRef.current;

        if (!socket) return;

        const receiveGroupMessage = (message) => {
            if (!selectedGroup) return;

            const messageGroupId =
                message.group?._id ||
                message.group;

            if (
                messageGroupId !==
                selectedGroup._id
            ) {
                return;
            }

            setMessages((previous) => {
                if (
                    previous.some(
                        (item) => item._id === message._id
                    )
                ) {
                    return previous;
                }

                return [...previous, message];
            });
        };

        socket.on(
            "receive-group-message",
            receiveGroupMessage
        );

        return () => {
            socket.off(
                "receive-group-message",
                receiveGroupMessage
            );
        };
    }, [selectedGroup]);

    // =================================================
    // SEND PRIVATE MESSAGE
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
            const response = await axios.post(
                `${API_URL}/api/messages/private`,
                {
                    senderId: currentUser._id,
                    receiverId: selectedUser._id,
                    text: messageText,
                    messageType: "text",
                }
            );

            const savedMessage = response.data;

            setMessages((previous) => {
                if (
                    previous.some(
                        (item) =>
                            item._id === savedMessage._id
                    )
                ) {
                    return previous;
                }

                return [...previous, savedMessage];
            });

            socketRef.current?.emit(
                "send-private-message",
                {
                    senderId: currentUser._id,
                    receiverId: selectedUser._id,
                    text: savedMessage.text,
                    messageType: savedMessage.messageType,
                    _id: savedMessage._id,
                    createdAt: savedMessage.createdAt,
                    sender: savedMessage.sender,
                    receiver: savedMessage.receiver,
                }
            );

            setMessageText("");
        } catch (error) {
            console.error(
                "❌ Failed to send message:",
                error.response?.data || error.message
            );
        }
    };

    // =================================================
    // SEND GROUP MESSAGE
    // =================================================

    const sendGroupMessage = async () => {
        if (
            !messageText.trim() ||
            !selectedGroup ||
            !currentUser
        ) {
            return;
        }

        try {
            const response = await axios.post(
                `${API_URL}/api/groups/${selectedGroup._id}/messages`,
                {
                    senderId: currentUser._id,
                    text: messageText,
                    messageType: "text",
                }
            );

            const savedMessage = response.data;

            setMessages((previous) => {
                if (
                    previous.some(
                        (item) =>
                            item._id === savedMessage._id
                    )
                ) {
                    return previous;
                }

                return [...previous, savedMessage];
            });

            socketRef.current?.emit(
                "send-group-message",
                savedMessage
            );

            setMessageText("");
        } catch (error) {
            console.error(
                "❌ Failed to send group message:",
                error.response?.data || error.message
            );
        }
    };

    // =================================================
    // SEND MESSAGE
    // =================================================

    const handleSend = () => {
        if (selectedGroup) {
            sendGroupMessage();
        } else {
            sendMessage();
        }
    };

    // =================================================
    // ENTER KEY
    // =================================================

    const handleKeyDown = (event) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();
            handleSend();
        }
    };

    // =================================================
    // CREATE GROUP
    // =================================================

    const createGroup = async () => {
        if (!groupName.trim()) return;
        if (!currentUser) return;

        try {
            const response = await axios.post(
                `${API_URL}/api/groups`,
                {
                    name: groupName.trim(),
                    createdBy: currentUser._id,
                    members: selectedMembers,
                }
            );

            setGroups((previous) => [
                response.data,
                ...previous,
            ]);

            setGroupName("");
            setSelectedMembers([]);
            setShowCreateGroup(false);
        } catch (error) {
            console.error(
                "❌ Group creation failed:",
                error.response?.data || error.message
            );
        }
    };

    // =================================================
    // TOGGLE MEMBER
    // =================================================

    const toggleMember = (userId) => {
        setSelectedMembers((previous) => {
            if (previous.includes(userId)) {
                return previous.filter(
                    (id) => id !== userId
                );
            }

            return [...previous, userId];
        });
    };

    // =================================================
    // ADD MEMBER
    // =================================================

    const addMember = async (userId) => {
        if (!selectedGroup) return;

        try {
            const response = await axios.post(
                `${API_URL}/api/groups/${selectedGroup._id}/members`,
                {
                    userId,
                }
            );

            setSelectedGroup(response.data);

            setGroups((previous) =>
                previous.map((group) =>
                    group._id === response.data._id
                        ? response.data
                        : group
                )
            );
        } catch (error) {
            console.error(
                "❌ Failed to add member:",
                error.response?.data || error.message
            );
        }
    };

    // =================================================
    // REMOVE MEMBER
    // =================================================

    const removeMember = async (userId) => {
        if (!selectedGroup) return;

        try {
            const response = await axios.delete(
                `${API_URL}/api/groups/${selectedGroup._id}/members/${userId}`
            );

            setSelectedGroup(response.data);

            setGroups((previous) =>
                previous.map((group) =>
                    group._id === response.data._id
                        ? response.data
                        : group
                )
            );
        } catch (error) {
            console.error(
                "❌ Failed to remove member:",
                error.response?.data || error.message
            );
        }
    };

    // =================================================
    // FILE UPLOAD
    // =================================================

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];

        if (!file) return;

        try {
            const formData = new FormData();

            formData.append("file", file);

            const uploadResponse = await axios.post(
                `${API_URL}/api/uploads`,
                formData
            );

            const {
                fileUrl,
                fileName,
                fileType,
            } = uploadResponse.data;

            const messageType =
                fileType.startsWith("image/")
                    ? "image"
                    : "file";

            // GROUP FILE
            if (selectedGroup) {
                const response = await axios.post(
                    `${API_URL}/api/groups/${selectedGroup._id}/messages`,
                    {
                        senderId: currentUser._id,
                        fileUrl,
                        fileName,
                        messageType,
                    }
                );

                const savedMessage = response.data;

                setMessages((previous) => {
                    if (
                        previous.some(
                            (item) =>
                                item._id ===
                                savedMessage._id
                        )
                    ) {
                        return previous;
                    }

                    return [
                        ...previous,
                        savedMessage,
                    ];
                });

                socketRef.current?.emit(
                    "send-group-message",
                    savedMessage
                );
            }

            // PRIVATE FILE
            else if (selectedUser) {
                const response = await axios.post(
                    `${API_URL}/api/messages/private`,
                    {
                        senderId: currentUser._id,
                        receiverId: selectedUser._id,
                        fileUrl,
                        fileName,
                        messageType,
                    }
                );

                const savedMessage = response.data;

                setMessages((previous) => {
                    if (
                        previous.some(
                            (item) =>
                                item._id ===
                                savedMessage._id
                        )
                    ) {
                        return previous;
                    }

                    return [
                        ...previous,
                        savedMessage,
                    ];
                });

                socketRef.current?.emit(
                    "send-private-message",
                    {
                        senderId: currentUser._id,
                        receiverId: selectedUser._id,
                        fileUrl,
                        fileName,
                        messageType,
                        _id: savedMessage._id,
                        createdAt:
                            savedMessage.createdAt,
                        sender:
                            savedMessage.sender,
                        receiver:
                            savedMessage.receiver,
                    }
                );
            }
        } catch (error) {
            console.error(
                "❌ File upload failed:",
                error.response?.data || error.message
            );
        }

        event.target.value = "";
    };

    // =================================================
    // FILTER USERS
    // =================================================

    const filteredUsers = users.filter((item) =>
        item.username
            ?.toLowerCase()
            .includes(searchText.toLowerCase())
    );

    // =================================================
    // OPEN PRIVATE CHAT
    // =================================================

    const openPrivateChat = (item) => {
        setSelectedUser(item);
        setSelectedGroup(null);
        setShowGroupMembers(false);
        setMessageText("");
    };

    // =================================================
    // OPEN GROUP
    // =================================================

    const openGroup = (group) => {
        setSelectedGroup(group);
        setSelectedUser(null);
        setShowGroupMembers(false);
        setMessageText("");
    };

    // =================================================
    // RENDER AVATAR
    // =================================================

    const renderAvatar = (
        person,
        className = "avatar"
    ) => {
        if (person?.profileImage) {
            return (
                <img
                    src={person.profileImage}
                    alt={person.username || "User"}
                    className={className}
                />
            );
        }

        return (
            <div className={`${className} avatar-fallback`}>
                {getInitials(
                    person?.username ||
                    person?.firstName ||
                    "User"
                )}
            </div>
        );
    };

    // =================================================
    // RENDER MESSAGE
    // =================================================

    const renderMessage = (
        message,
        isGroup = false
    ) => {
        const senderId =
            message.sender?._id ||
            message.senderId;

        const isMyMessage =
            senderId === currentUser?._id;

        const senderName =
            message.sender?.username ||
            "User";

        return (
            <div
                key={message._id}
                className={`message-row ${
                    isMyMessage
                        ? "mine"
                        : "other"
                }`}
            >
                {!isMyMessage && (
                    <div className="message-avatar-wrap">
                        {renderAvatar(
                            message.sender,
                            "message-avatar"
                        )}
                    </div>
                )}

                <div
                    className={`message-content ${
                        isMyMessage
                            ? "mine"
                            : ""
                    }`}
                >
                    {!isMyMessage &&
                        isGroup && (
                            <div className="sender-name">
                                {senderName}
                            </div>
                        )}

                    <div
                        className={`message-bubble ${
                            isMyMessage
                                ? "mine"
                                : "other"
                        }`}
                    >
                        {message.text && (
                            <div className="message-text">
                                {message.text}
                            </div>
                        )}

                        {message.messageType ===
                            "image" && (
                            <img
                                src={message.fileUrl}
                                alt={
                                    message.fileName ||
                                    "Shared image"
                                }
                                className="chat-image"
                            />
                        )}

                        {message.messageType ===
                            "file" && (
                            <a
                                href={
                                    message.fileUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="file-message"
                            >
                                <span className="file-icon">
                                    ↗
                                </span>

                                <span className="file-name">
                                    {message.fileName}
                                </span>
                            </a>
                        )}

                        <div className="message-meta">
                            <span>
                                {formatTime(
                                    message.createdAt
                                )}
                            </span>

                            {isMyMessage && (
                                <span className="message-check">
                                    ✓
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // =================================================
    // RENDER
    // =================================================

    return (
        <div
            className={
                darkMode
                    ? "chat-app dark"
                    : "chat-app"
            }
        >
            {/* =========================================
                SIDEBAR
            ========================================= */}

            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="brand">
                        <div className="brand-mark">
                            C
                        </div>

                        <div>
                            <h2>ChatFlow</h2>
                            <span>Messages made simple</span>
                        </div>
                    </div>

                    <button
                        className="theme-button"
                        onClick={() =>
                            setDarkMode(
                                (previous) =>
                                    !previous
                            )
                        }
                        title="Toggle theme"
                    >
                        {darkMode ? "☼" : "☾"}
                    </button>
                </div>

                {/* CURRENT USER */}

                <div className="profile-strip">
                    <div className="profile-avatar-wrap">
                        {user?.imageUrl ? (
                            <img
                                src={user.imageUrl}
                                alt="Profile"
                                className="profile-avatar"
                            />
                        ) : (
                            <div className="profile-avatar avatar-fallback">
                                {getInitials(
                                    user?.firstName ||
                                    user?.username ||
                                    "User"
                                )}
                            </div>
                        )}

                        <span className="profile-online"></span>
                    </div>

                    <div className="profile-info">
                        <strong>
                            {user?.firstName ||
                                user?.username ||
                                "User"}
                        </strong>

                        <span>
                            Available
                        </span>
                    </div>

                    <div className="clerk-button">
                        <UserButton />
                    </div>
                </div>

                {/* SEARCH */}

                <div className="search-box">
                    <span className="search-icon">
                        ⌕
                    </span>

                    <input
                        type="text"
                        placeholder="Search people"
                        value={searchText}
                        onChange={(event) =>
                            setSearchText(
                                event.target.value
                            )
                        }
                    />

                    {searchText && (
                        <button
                            className="clear-search"
                            onClick={() =>
                                setSearchText("")
                            }
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* DIRECT MESSAGES */}

                <div className="sidebar-scroll">
                    <div className="sidebar-section">
                        <div className="section-heading">
                            <span>DIRECT MESSAGES</span>
                            <small>
                                {filteredUsers.length}
                            </small>
                        </div>

                        {loadingUsers ? (
                            <div className="loading-state">
                                <div className="skeleton avatar-skeleton"></div>

                                <div className="skeleton-lines">
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="empty-sidebar">
                                No people found
                            </div>
                        ) : (
                            filteredUsers.map((item) => (
                                <button
                                    key={item._id}
                                    className={`user-item ${
                                        selectedUser?._id ===
                                        item._id
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        openPrivateChat(
                                            item
                                        )
                                    }
                                >
                                    <div className="avatar-wrap">
                                        {renderAvatar(
                                            item,
                                            "user-avatar"
                                        )}

                                        <span
                                            className={`avatar-status ${
                                                item.isOnline
                                                    ? "online"
                                                    : "offline"
                                            }`}
                                        ></span>
                                    </div>

                                    <div className="user-info">
                                        <strong>
                                            {
                                                item.username
                                            }
                                        </strong>

                                        <span>
                                            {item.isOnline
                                                ? "Active now"
                                                : "Offline"}
                                        </span>
                                    </div>

                                    {selectedUser?._id ===
                                        item._id && (
                                        <span className="active-indicator"></span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* GROUPS */}

                    <div className="sidebar-section groups-section">
                        <div className="section-title">
                            <div className="section-heading">
                                <span>GROUPS</span>
                                <small>
                                    {groups.length}
                                </small>
                            </div>

                            <button
                                className="add-group-button"
                                onClick={() =>
                                    setShowCreateGroup(
                                        true
                                    )
                                }
                                title="Create group"
                            >
                                +
                            </button>
                        </div>

                        {groups.length === 0 ? (
                            <button
                                className="create-first-group"
                                onClick={() =>
                                    setShowCreateGroup(
                                        true
                                    )
                                }
                            >
                                <span>+</span>
                                <div>
                                    <strong>
                                        Create a group
                                    </strong>
                                    <small>
                                        Start a shared
                                        conversation
                                    </small>
                                </div>
                            </button>
                        ) : (
                            groups.map((group) => (
                                <button
                                    key={group._id}
                                    className={`group-item ${
                                        selectedGroup?._id ===
                                        group._id
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        openGroup(
                                            group
                                        )
                                    }
                                >
                                    <div className="group-avatar">
                                        {group.members
                                            ?.slice(0, 3)
                                            .map(
                                                (
                                                    member,
                                                    index
                                                ) => (
                                                    member.profileImage ? (
                                                        <img
                                                            key={
                                                                member._id
                                                            }
                                                            src={
                                                                member.profileImage
                                                            }
                                                            alt=""
                                                            className={`group-stack-avatar stack-${index}`}
                                                        />
                                                    ) : (
                                                        <div
                                                            key={
                                                                member._id
                                                            }
                                                            className={`group-stack-avatar stack-${index} avatar-fallback`}
                                                        >
                                                            {getInitials(
                                                                member.username
                                                            ).charAt(
                                                                0
                                                            )}
                                                        </div>
                                                    )
                                                )
                                            )}
                                    </div>

                                    <div className="group-info">
                                        <strong>
                                            {
                                                group.name
                                            }
                                        </strong>

                                        <span>
                                            {
                                                group.members
                                                    ?.length
                                            }{" "}
                                            members
                                        </span>
                                    </div>

                                    {selectedGroup?._id ===
                                        group._id && (
                                        <span className="active-indicator"></span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="sidebar-footer">
                    <span>
                        <i></i>
                        Connected
                    </span>

                    <small>
                        ChatFlow
                    </small>
                </div>
            </aside>

            {/* =========================================
                MAIN CHAT
            ========================================= */}

            <main className="chat-area">
                {selectedGroup ? (
                    <>
                        {/* GROUP HEADER */}

                        <header className="chat-header">
                            <div className="header-avatar group-header-avatar">
                                <span>
                                    {getInitials(
                                        selectedGroup.name
                                    ).charAt(0)}
                                </span>
                            </div>

                            <div className="chat-header-info">
                                <div className="chat-title-row">
                                    <h3>
                                        {
                                            selectedGroup.name
                                        }
                                    </h3>

                                    <span className="conversation-label">
                                        GROUP
                                    </span>
                                </div>

                                <span>
                                    {
                                        selectedGroup
                                            .members
                                            ?.length
                                    }{" "}
                                    members
                                </span>
                            </div>

                            <div className="chat-actions">
                                <button
                                    className={`header-action ${
                                        showGroupMembers
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setShowGroupMembers(
                                            (previous) =>
                                                !previous
                                        )
                                    }
                                >
                                    <span>♧</span>
                                    Members
                                </button>
                            </div>
                        </header>

                        {/* GROUP MEMBERS */}

                        {showGroupMembers && (
                            <div className="group-members-panel">
                                <div className="panel-heading">
                                    <div>
                                        <span>
                                            GROUP
                                            INFORMATION
                                        </span>

                                        <h3>
                                            Members
                                        </h3>
                                    </div>

                                    <button
                                        onClick={() =>
                                            setShowGroupMembers(
                                                false
                                            )
                                        }
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="member-count-card">
                                    <strong>
                                        {
                                            selectedGroup
                                                .members
                                                ?.length
                                        }
                                    </strong>

                                    <span>
                                        people in this
                                        conversation
                                    </span>
                                </div>

                                <div className="members-list">
                                    {selectedGroup.members.map(
                                        (member) => (
                                            <div
                                                key={
                                                    member._id
                                                }
                                                className="member-row"
                                            >
                                                <div className="member-details">
                                                    <div className="member-avatar-wrap">
                                                        {renderAvatar(
                                                            member,
                                                            "member-avatar"
                                                        )}

                                                        <span
                                                            className={
                                                                member.isOnline
                                                                    ? "member-online"
                                                                    : "member-offline"
                                                            }
                                                        ></span>
                                                    </div>

                                                    <div>
                                                        <strong>
                                                            {
                                                                member.username
                                                            }

                                                            {member._id ===
                                                                currentUser?._id && (
                                                                <em>
                                                                    You
                                                                </em>
                                                            )}
                                                        </strong>

                                                        <span>
                                                            {member.isOnline
                                                                ? "Online"
                                                                : "Offline"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {member._id !==
                                                    currentUser?._id && (
                                                    <button
                                                        onClick={() =>
                                                            removeMember(
                                                                member._id
                                                            )
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>

                                <div className="add-member-section">
                                    <span className="panel-label">
                                        ADD PEOPLE
                                    </span>

                                    {users
                                        .filter(
                                            (
                                                userItem
                                            ) =>
                                                !selectedGroup.members.some(
                                                    (
                                                        member
                                                    ) =>
                                                        member._id ===
                                                        userItem._id
                                                )
                                        )
                                        .map(
                                            (
                                                userItem
                                            ) => (
                                                <div
                                                    key={
                                                        userItem._id
                                                    }
                                                    className="member-row add-row"
                                                >
                                                    <div className="member-details">
                                                        {renderAvatar(
                                                            userItem,
                                                            "member-avatar"
                                                        )}

                                                        <strong>
                                                            {
                                                                userItem.username
                                                            }
                                                        </strong>
                                                    </div>

                                                    <button
                                                        className="add-button"
                                                        onClick={() =>
                                                            addMember(
                                                                userItem._id
                                                            )
                                                        }
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            )
                                        )}
                                </div>
                            </div>
                        )}

                        {/* MESSAGES */}

                        <div className="messages-area">
                            {loadingMessages ? (
                                <div className="conversation-loading">
                                    <div className="loader-ring"></div>
                                    <span>
                                        Loading messages
                                    </span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="empty-chat">
                                    <div className="empty-chat-icon">
                                        {getInitials(
                                            selectedGroup.name
                                        ).charAt(0)}
                                    </div>

                                    <span className="empty-eyebrow">
                                        NEW CONVERSATION
                                    </span>

                                    <h3>
                                        Start the
                                        conversation
                                    </h3>

                                    <p>
                                        Send the first
                                        message to{" "}
                                        <strong>
                                            {
                                                selectedGroup.name
                                            }
                                        </strong>
                                        .
                                    </p>
                                </div>
                            ) : (
                                messages.map((message) =>
                                    renderMessage(
                                        message,
                                        true
                                    )
                                )
                            )}
                        </div>
                    </>
                ) : selectedUser ? (
                    <>
                        {/* PRIVATE HEADER */}

                        <header className="chat-header">
                            <div className="header-avatar">
                                {renderAvatar(
                                    selectedUser,
                                    "header-user-avatar"
                                )}

                                <span
                                    className={`header-avatar-status ${
                                        selectedUser.isOnline
                                            ? "online"
                                            : "offline"
                                    }`}
                                ></span>
                            </div>

                            <div className="chat-header-info">
                                <div className="chat-title-row">
                                    <h3>
                                        {
                                            selectedUser.username
                                        }
                                    </h3>
                                </div>

                                <span>
                                    <i
                                        className={
                                            selectedUser.isOnline
                                                ? "status-dot online"
                                                : "status-dot offline"
                                        }
                                    ></i>

                                    {selectedUser.isOnline
                                        ? "Active now"
                                        : "Offline"}
                                </span>
                            </div>

                            <div className="chat-actions">
                                <span className="private-label">
                                    Private conversation
                                </span>

                                <button
                                    className="header-more"
                                    title="More options"
                                >
                                    ···
                                </button>
                            </div>
                        </header>

                        {/* PRIVATE MESSAGES */}

                        <div className="messages-area">
                            {loadingMessages ? (
                                <div className="conversation-loading">
                                    <div className="loader-ring"></div>
                                    <span>
                                        Loading messages
                                    </span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="empty-chat">
                                    <div className="empty-profile">
                                        {renderAvatar(
                                            selectedUser,
                                            "empty-profile-avatar"
                                        )}

                                        <span></span>
                                    </div>

                                    <span className="empty-eyebrow">
                                        PRIVATE CHAT
                                    </span>

                                    <h3>
                                        Say hello to{" "}
                                        {
                                            selectedUser.username
                                        }
                                    </h3>

                                    <p>
                                        This is the
                                        beginning of
                                        your private
                                        conversation.
                                    </p>
                                </div>
                            ) : (
                                messages.map((message) =>
                                    renderMessage(
                                        message,
                                        false
                                    )
                                )
                            )}
                        </div>
                    </>
                ) : (
                    /* =====================================
                       WELCOME
                    ===================================== */

                    <div className="welcome-screen">
                        <div className="welcome-content">
                            <div className="welcome-logo">
                                C
                            </div>

                            <span className="welcome-eyebrow">
                                REAL-TIME MESSAGING
                            </span>

                            <h1>
                                A quieter way to
                                <br />
                                <span>stay connected.</span>
                            </h1>

                            <p>
                                Pick a conversation from
                                the sidebar to start
                                chatting.
                            </p>

                            <div className="welcome-features">
                                <div>
                                    <strong>
                                        Real-time
                                    </strong>
                                    <span>
                                        Instant messages
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        Groups
                                    </strong>
                                    <span>
                                        Conversations
                                        together
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        Files
                                    </strong>
                                    <span>
                                        Photos &
                                        documents
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================
                    COMPOSER
                ========================================= */}

                {(selectedUser ||
                    selectedGroup) && (
                    <div className="message-input-area">
                        <div className="composer-shell">
                            <input
                                type="file"
                                id="file-upload"
                                hidden
                                onChange={
                                    handleFileUpload
                                }
                            />

                            <label
                                htmlFor="file-upload"
                                className="attachment-button"
                                title="Attach file"
                            >
                                +
                            </label>

                            <input
                                type="text"
                                className="message-input"
                                placeholder={
                                    selectedGroup
                                        ? `Message ${selectedGroup.name}`
                                        : `Message ${selectedUser?.username || ""}`
                                }
                                value={messageText}
                                onChange={(event) =>
                                    setMessageText(
                                        event.target.value
                                    )
                                }
                                onKeyDown={
                                    handleKeyDown
                                }
                            />

                            <button
                                className="emoji-button"
                                type="button"
                                onClick={() =>
                                    setMessageText(
                                        (previous) =>
                                            previous +
                                            " 😊"
                                    )
                                }
                                title="Add emoji"
                            >
                                ☺
                            </button>

                            <button
                                className="send-button"
                                onClick={
                                    handleSend
                                }
                                disabled={
                                    !messageText.trim()
                                }
                                title="Send message"
                            >
                                ↑
                            </button>
                        </div>

                        <div className="composer-tip">
                            Enter to send
                            <span>•</span>
                            + to attach files
                        </div>
                    </div>
                )}
            </main>

            {/* =========================================
                CREATE GROUP MODAL
            ========================================= */}

            {showCreateGroup && (
                <div
                    className="modal-overlay"
                    onClick={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setShowCreateGroup(
                                false
                            );
                            setGroupName("");
                            setSelectedMembers([]);
                        }
                    }}
                >
                    <div className="modal">
                        <div className="modal-header">
                            <div>
                                <span className="modal-label">
                                    NEW GROUP
                                </span>

                                <h2>
                                    Create a group
                                </h2>

                                <p>
                                    Start a shared
                                    conversation.
                                </p>
                            </div>

                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowCreateGroup(
                                        false
                                    );
                                    setGroupName("");
                                    setSelectedMembers(
                                        []
                                    );
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <label className="input-label">
                            GROUP NAME
                        </label>

                        <input
                            className="modal-input"
                            type="text"
                            placeholder="e.g. Project Alpha"
                            value={groupName}
                            onChange={(event) =>
                                setGroupName(
                                    event.target.value
                                )
                            }
                            autoFocus
                        />

                        <div className="member-heading">
                            <div>
                                <label className="input-label">
                                    MEMBERS
                                </label>

                                <p>
                                    Choose who can join
                                    this group.
                                </p>
                            </div>

                            <span className="selected-count">
                                {
                                    selectedMembers.length
                                }
                            </span>
                        </div>

                        <div className="member-selection">
                            {users.length === 0 ? (
                                <p className="no-members">
                                    No other users
                                    available.
                                </p>
                            ) : (
                                users.map((item) => (
                                    <label
                                        key={
                                            item._id
                                        }
                                        className={`member-option ${
                                            selectedMembers.includes(
                                                item._id
                                            )
                                                ? "checked"
                                                : ""
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMembers.includes(
                                                item._id
                                            )}
                                            onChange={() =>
                                                toggleMember(
                                                    item._id
                                                )
                                            }
                                        />

                                        {renderAvatar(
                                            item,
                                            "modal-member-avatar"
                                        )}

                                        <div className="modal-member-info">
                                            <strong>
                                                {
                                                    item.username
                                                }
                                            </strong>

                                            <span>
                                                {item.isOnline
                                                    ? "Online"
                                                    : "Offline"}
                                            </span>
                                        </div>

                                        <span className="checkbox-custom">
                                            ✓
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>

                        <div className="modal-buttons">
                            <button
                                className="cancel-button"
                                onClick={() => {
                                    setShowCreateGroup(
                                        false
                                    );
                                    setGroupName("");
                                    setSelectedMembers(
                                        []
                                    );
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                className="create-button"
                                onClick={
                                    createGroup
                                }
                                disabled={
                                    !groupName.trim()
                                }
                            >
                                Create group
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================================================
// APP
// =====================================================

function App() {
    return (
        <>
            <SignedOut>
                <div className="auth-container">
                    <div className="auth-brand">
                        <div className="auth-logo">
                            C
                        </div>

                        <div>
                            <h1>ChatFlow</h1>
                            <p>
                                Simple, real-time
                                conversations.
                            </p>
                        </div>
                    </div>

                    <div className="auth-box">
                        <SignIn />
                    </div>

                    <span className="auth-footer">
                        Secure authentication
                    </span>
                </div>
            </SignedOut>

            <SignedIn>
                <ChatApp />
            </SignedIn>
        </>
    );
}

export default App;