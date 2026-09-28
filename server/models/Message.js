const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        receiver: {
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

module.exports = mongoose.model("Message", messageSchema);