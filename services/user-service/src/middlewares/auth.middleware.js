const AUTH_CACHE_TTL = 900; // 5 minutes
import { redis } from "../config/redis.config.js";
import jwt from 'jsonwebtoken'
import prisma  from '../config/prisma.js'

export const verifyJWT = async (req, res, next) => {
    try {
        const token =
            req.cookies?.refreshToken ||
            req.headers["authorization"]?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Unauthorized user" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user_id = BigInt(decoded.id);
        const cacheKey = `auth:user:${user_id}`;

        let user = null;
        try {
            user = await redis.get(cacheKey);
        } catch (redisErr) {
            console.error("[Redis] Auth cache GET failed:", redisErr.message);
        }

        if (!user) {
            user = await prisma.user.findUnique({
                where: { id: user_id },
                select: { id: true, roleId: true }
            });

            if (!user) {
                return res.status(401).json({ message: "User not found!" });
            }

            try {
                await redis.set(cacheKey, { id: Number(user.id), roleId: Number(user.roleId) }, { ex: AUTH_CACHE_TTL });
            } catch (redisErr) {
                console.error("[Redis] Auth cache SET failed:", redisErr.message);
            }
        }

        req.user = {
            id: Number(user.id),
            role_id: Number(user.roleId ?? user.role_id),
            session_id: decoded.session_id ? Number(decoded.session_id) : undefined
        };

        next();
    } catch (error) {
        console.error("Auth error:", error);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};