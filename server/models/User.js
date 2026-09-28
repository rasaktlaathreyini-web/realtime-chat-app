const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        clerkId: {
            type: String,
            required: true,
            unique: true,
        },

        username: {
            type: String,
            required: true,
        },

        email: {
            type: String,
            required: true,
        },

        profileImage: {
            type: String,
            default: "",
        },

        isOnline: {
            type: Boolean,
            default: false,
        },

        lastSeen: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);