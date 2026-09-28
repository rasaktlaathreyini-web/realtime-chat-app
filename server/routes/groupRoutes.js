const express = require("express");

const Group =
    require("../models/Group");

const GroupMessage =
    require("../models/GroupMessage");

const User =
    require("../models/User");

const router = express.Router();


// =====================================================
// CREATE GROUP
// =====================================================

router.post("/", async (req, res) => {

    try {

        const {
            name,
            createdBy,
            members,
        } = req.body;


        if (!name || !createdBy) {

            return res.status(400).json({
                message:
                    "Group name and creator are required",
            });

        }


        const creator =
            await User.findById(
                createdBy
            );


        if (!creator) {

            return res.status(404).json({
                message:
                    "Creator not found",
            });

        }


        const groupMembers = [
            createdBy,
            ...(members || []),
        ];


        const uniqueMembers = [
            ...new Set(
                groupMembers.map(
                    (id) =>
                        id.toString()
                )
            ),
        ];


        const group =
            await Group.create({

                name:
                    name.trim(),

                createdBy,

                members:
                    uniqueMembers,

            });


        const populatedGroup =
            await Group.findById(
                group._id
            )
                .populate(
                    "createdBy",
                    "username profileImage"
                )
                .populate(
                    "members",
                    "username email profileImage isOnline"
                );


        res.status(201).json(
            populatedGroup
        );


    } catch (error) {

        console.error(
            "❌ Create group error:",
            error
        );

        res.status(500).json({
            message:
                "Failed to create group",
        });

    }

});


// =====================================================
// GET USER GROUPS
// =====================================================

router.get(
    "/user/:userId",
    async (req, res) => {

        try {

            const groups =
                await Group.find({
                    members:
                        req.params.userId,
                })
                    .populate(
                        "createdBy",
                        "username profileImage"
                    )
                    .populate(
                        "members",
                        "username email profileImage isOnline"
                    )
                    .sort({
                        updatedAt: -1,
                    });


            res.json(groups);


        } catch (error) {

            console.error(
                "❌ Get groups error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch groups",
            });

        }

    }
);


// =====================================================
// GET GROUP
// =====================================================

router.get(
    "/:groupId",
    async (req, res) => {

        try {

            const group =
                await Group.findById(
                    req.params.groupId
                )
                    .populate(
                        "createdBy",
                        "username profileImage"
                    )
                    .populate(
                        "members",
                        "username email profileImage isOnline"
                    );


            if (!group) {

                return res.status(404).json({
                    message:
                        "Group not found",
                });

            }


            res.json(group);


        } catch (error) {

            console.error(
                "❌ Get group error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch group",
            });

        }

    }
);


// =====================================================
// ADD MEMBER
// =====================================================

router.post(
    "/:groupId/members",
    async (req, res) => {

        try {

            const {
                userId,
            } = req.body;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "User ID is required",
                });

            }


            const group =
                await Group.findByIdAndUpdate(

                    req.params.groupId,

                    {
                        $addToSet: {
                            members:
                                userId,
                        },
                    },

                    {
                        new: true,
                    }

                )
                    .populate(
                        "createdBy",
                        "username profileImage"
                    )
                    .populate(
                        "members",
                        "username email profileImage isOnline"
                    );


            if (!group) {

                return res.status(404).json({
                    message:
                        "Group not found",
                });

            }


            res.json(group);


        } catch (error) {

            console.error(
                "❌ Add member error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to add member",
            });

        }

    }
);


// =====================================================
// REMOVE MEMBER
// =====================================================

router.delete(
    "/:groupId/members/:userId",
    async (req, res) => {

        try {

            const group =
                await Group.findByIdAndUpdate(

                    req.params.groupId,

                    {
                        $pull: {
                            members:
                                req.params.userId,
                        },
                    },

                    {
                        new: true,
                    }

                )
                    .populate(
                        "createdBy",
                        "username profileImage"
                    )
                    .populate(
                        "members",
                        "username email profileImage isOnline"
                    );


            if (!group) {

                return res.status(404).json({
                    message:
                        "Group not found",
                });

            }


            res.json(group);


        } catch (error) {

            console.error(
                "❌ Remove member error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to remove member",
            });

        }

    }
);


// =====================================================
// GET GROUP MESSAGES
// =====================================================

router.get(
    "/:groupId/messages",
    async (req, res) => {

        try {

            const messages =
                await GroupMessage.find({
                    group:
                        req.params.groupId,
                })
                    .populate(
                        "sender",
                        "username profileImage"
                    )
                    .sort({
                        createdAt: 1,
                    });


            res.json(messages);


        } catch (error) {

            console.error(
                "❌ Get group messages error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch group messages",
            });

        }

    }
);


// =====================================================
// SEND GROUP MESSAGE
// =====================================================

router.post(
    "/:groupId/messages",
    async (req, res) => {

        try {

            const {
                senderId,
                text,
                fileUrl,
                fileName,
                messageType,
            } = req.body;


            if (!senderId) {

                return res.status(400).json({
                    message:
                        "Sender is required",
                });

            }


            const group =
                await Group.findById(
                    req.params.groupId
                );


            if (!group) {

                return res.status(404).json({
                    message:
                        "Group not found",
                });

            }


            const isMember =
                group.members.some(
                    (memberId) =>
                        memberId.toString() ===
                        senderId.toString()
                );


            if (!isMember) {

                return res.status(403).json({
                    message:
                        "You are not a member of this group",
                });

            }


            const message =
                await GroupMessage.create({

                    group:
                        req.params.groupId,

                    sender:
                        senderId,

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
                await GroupMessage.findById(
                    message._id
                )
                    .populate(
                        "sender",
                        "username profileImage"
                    );


            await Group.findByIdAndUpdate(
                req.params.groupId,
                {
                    updatedAt:
                        new Date(),
                }
            );


            res.status(201).json(
                populatedMessage
            );


        } catch (error) {

            console.error(
                "❌ Send group message error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to send group message",
            });

        }

    }
);


module.exports = router;