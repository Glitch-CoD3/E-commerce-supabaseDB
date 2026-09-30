import { checkLimit }  from '../service/tokenBucket.service.js';

function buildClientKey(identity) {
    const { userId, apiKey, deviceId, ip, endpoint } = identity;

    let who;
    if (userId)        who = `user:${userId}`;
    else if (apiKey)   who = `key:${apiKey}`;
    else if (deviceId) who = `device:${deviceId}`;
    else if (ip)       who = `ip:${ip}`;
    else return null;

    return `${who}|${endpoint || "any"}`;
}

export const checkRateLimit = async (req, res) => {
    const { service, identity } = req.body;

    if (!service || !identity) {
        return res.status(400).json({ message: "service and identity are required" });
    }

    const clientKey = buildClientKey(identity);
    if (!clientKey) {
        return res.status(400).json({ message: "no usable identity" });
    }

    try {
        const result = await checkLimit(service, clientKey);
        console.log("Rate limit check:", clientKey, result);

        if (!result.allowed) {
            res.set("Retry-After", String(result.retryAfter));
            return res.status(429).json({
                allowed: false,
                message: "Too many requests",
                retryAfter: result.retryAfter,
            });
        }

        return res.status(200).json({ allowed: true, remaining: result.remaining });
    } catch (err) {
        console.error("Rate limit error:", err.message);
        return res.status(503).json({ message: "Rate limiter unavailable" });
    }
};