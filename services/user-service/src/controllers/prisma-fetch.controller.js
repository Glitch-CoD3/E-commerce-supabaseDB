import prisma from "../config/prisma.js";

const publicUser = (user) => ({
    id: Number(user.id),
    full_name: user.fullName,
    email: user.email,
    phone_number: user.phoneNumber
});

const get_me = async (req, res) => {
    try {
        if (!req.user?.id) return res.status(401).json({ message: "Unauthorized user request" });
        const user = await prisma.user.findUnique({ where: { id: BigInt(req.user.id) } });
        if (!user) return res.status(401).json({ message: "User no Found" });
        return res.status(200).json({ success: "success", user: publicUser(user) });
    } catch (error) {
        console.error("Prisma get-me error:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

const getUserById = async (req, res) => {
    try {
        if (!req.params.id) return res.status(400).json({ message: "User id is required" });
        const user = await prisma.user.findUnique({ where: { id: BigInt(req.params.id) } });
        if (!user) return res.status(404).json({ message: "User not Found" });
        return res.status(200).json({ success: "success", user: publicUser(user) });
    } catch (error) {
        console.error("Prisma user fetch error:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { get_me, getUserById };
