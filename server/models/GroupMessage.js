const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema(
    {
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true,
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        text: {
            type: String,
            default: "",
        },

        fileUrl: {
            type: String,
            default: "",
        },

        fileName: {
            type: String,
            default: "",
        },

        messageType: {
            type: String,
            enum: ["text", "file", "image"],
            default: "text",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "GroupMessage",
    groupMessageSchema
);