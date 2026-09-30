const normalizeIp = (ip) => {
    const clean = (ip || '').replace(/^::ffff:/, '');
    return clean === '::1' ? '127.0.0.1' : clean;   // IPv6 localhost -> IPv4 localhost
};

const extractIdentity = (req, res, next) => {
   req.identity = {
        userId: Number(req.user?.user?.id ) ?? null,
        ip: normalizeIp(req.ip),
        apiKey: req.headers['x-api-key'] || null,
        deviceId: req.headers['x-device-id'] || null,
        endpoint: `${req.method} ${req.baseUrl}`,
    };
    next();
};

export default extractIdentity;