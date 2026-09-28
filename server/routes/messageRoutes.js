const express = require("express");

const Message =
    require("../models/Message");

const User =
    require("../models/User");

const router = express.Router();


// =====================================================
// GET PRIVATE MESSAGES
// =====================================================

router.get(
    "/private/:userId/:otherUserId",
    async (req, res) => {

        try {

            const {
                userId,
                otherUserId,
            } = req.params;


            const messages =
                await Message.find({

                    $or: [

                        {
                            sender: userId,
                            receiver:
                                otherUserId,
                        },

                        {
                            sender:
                                otherUserId,
                            receiver:
                                userId,
                        },

                    ],

                })
                    .populate(
                        "sender",
                        "username profileImage"
                    )
                    .populate(
                        "receiver",
                        "username profileImage"
                    )
                    .sort({
                        createdAt: 1,
                    });


            res.json(messages);


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Failed to fetch messages",
            });

        }

    }
);


// =====================================================
// SEND PRIVATE MESSAGE
// =====================================================

router.post(
    "/private",
    async (req, res) => {

        try {

            const {
                senderId,
                receiverId,
                text,
                fileUrl,
                fileName,
                messageType,
            } = req.body;


            if (
                !senderId ||
                !receiverId
            ) {

                return res.status(400).json({
                    message:
                        "Sender and receiver are required",
                });

            }


            const sender =
                await User.findById(
                    senderId
                );

            const receiver =
                await User.findById(
                    receiverId
                );


            if (
                !sender ||
                !receiver
            ) {

                return res.status(404).json({
                    message:
                        "User not found",
                });

            }


            const message =
                await Message.create({

                    sender:
                        senderId,

                    receiver:
                        receiverId,

                    text:
                        text || "",

                    fileUrl:
                        fileUrl || "",

                    fileName:
                        fileName || "",

                    messageType:
                        messageType || "text",

                });


            const populatedMessage =
                await Message.findById(
                    message._id
                )
                    .populate(
                        "sender",
                        "username profileImage"
                    )
                    .populate(
                        "receiver",
                        "username profileImage"
                    );


            res.status(201).json(
                populatedMessage
            );


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Failed to send message",
            });

        }

    }
);


module.exports = router;