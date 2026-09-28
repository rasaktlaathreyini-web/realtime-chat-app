const express = require("express");

const User =
    require("../models/User");

const router = express.Router();


// =====================================================
// GET ALL USERS
// =====================================================

router.get("/", async (req, res) => {

    try {

        const users =
            await User.find()
                .sort({
                    username: 1,
                });

        res.json(users);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message:
                "Failed to fetch users",
        });

    }

});


// =====================================================
// SYNC CLERK USER
// =====================================================

router.post(
    "/sync",
    async (req, res) => {

        try {

            const {
                clerkId,
                username,
                email,
                profileImage,
            } = req.body;


            if (
                !clerkId ||
                !username ||
                !email
            ) {

                return res.status(400).json({
                    message:
                        "clerkId, username and email are required",
                });

            }


            const user =
                await User.findOneAndUpdate(

                    {
                        clerkId,
                    },

                    {
                        clerkId,
                        username,
                        email,
                        profileImage:
                            profileImage || "",
                    },

                    {
                        upsert: true,
                        returnDocument:
                            "after",
                    }

                );


            res.json(user);


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Failed to sync user",
            });

        }

    }
);


module.exports = router;