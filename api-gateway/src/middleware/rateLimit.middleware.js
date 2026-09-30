import extractIdentity from './extract_identity.middleware.js';

const RATE_LIMITER_URI = process.env.RATE_LIMITER_URI || 'http://localhost:8004';

const checkWithLimiter = (serviceName) => async (req, res, next) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
        const response = await fetch(`${RATE_LIMITER_URI}/api/v1/rate-limit/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: serviceName, identity: req.identity }),
            signal: controller.signal,
        });

        // console.log("identity", req.identity);
        const data = await response.json();
        // console.log("Rate limit check response:", data);

        if (response.status === 429) {
            res.set('Retry-After', String(data.retryAfter));
            return res.status(429).json({
                message: 'Too many requests',
                retryAfter: data.retryAfter,
            });
        }

        res.set('X-RateLimit-Remaining', String(data.remaining));
        return next();
    } catch (err) {
        console.error('Rate limiter unreachable:', err.message);
        return next(); // fail open
    } finally {
        clearTimeout(timeout);
    }
};

// Runs extractIdentity first, then the limiter check
const rateLimit = (serviceName) => [extractIdentity, checkWithLimiter(serviceName)];

export default rateLimit;