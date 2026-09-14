import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export const verifyJWT = async (req, res, next) => {
    try {
        const token =
            req.cookies?.refreshToken ||
            req.headers["authorization"]?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Unauthorized user"
            });
        }


        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user_id = (decoded.id);
        

        // Prisma query
        const user = await prisma.user.findUnique({
            where: {
                id: user_id
            },
            select: {
                id: true,
                roleId: true
            }
        });

        if (!user) {
            return res.status(401).json({
                message: "User not found!"
            });
        }

        req.user = {
            id: Number(user.id),
            role_id: Number(user.roleId),
            session_id: decoded.session_id
                ? Number(decoded.session_id)
                : undefined
        };

        next();

    } catch (error) {
        console.error("Auth error:", error);

        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};