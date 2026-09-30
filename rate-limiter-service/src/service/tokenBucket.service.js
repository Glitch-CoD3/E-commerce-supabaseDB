import rateRules  from '../rate.rules.js';
import { redis, TOKEN_BUCKET_LUA } from "../config/redis.config.js";

class TokenBucket {
    constructor(capacity, refillRate) {
        this.capacity = capacity;       // Maximum tokens
        this.tokens = capacity;         // Start with full bucket
        this.refillRate = refillRate;   // Tokens added per second
        this.lastRefillTime = Date.now();
    }

    refill() {
        const now = Date.now();
        const secondsPassed = (now - this.lastRefillTime) / 1000;
        const newTokens = secondsPassed * this.refillRate;

        this.tokens = Math.min(this.capacity, this.tokens + newTokens);
        this.lastRefillTime = now;
    }

    allowRequest() {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;   // Request allowed
        }
        return false;      // Request rejected
    }

    // Seconds until the next token is available
    retryAfter() {
        const missing = 1 - this.tokens;
        return Math.ceil(missing / this.refillRate);
    }
}

// One bucket per (service + client)
const buckets = new Map();

function getBucket(service, clientId) {
    const rule = rateRules[service] || rateRules.default;
    const key = `${service}:${clientId}`;

    if (!buckets.has(key)) {
        buckets.set(key, new TokenBucket(rule.capacity, rule.refillRate));
    }
    return buckets.get(key);
}

export async function checkLimit(service, clientKey) {
    const rule = rateRules[service] || rateRules.default;
    const key = `rl:${service}:${clientKey}`;

    const [allowed, tokens, retryAfter] = await redis.eval(
        TOKEN_BUCKET_LUA,
        [key],
        [rule.capacity, rule.refillRate, Date.now()]
    );

    return {
        allowed: Number(allowed) === 1,
        remaining: Math.floor(parseFloat(String(tokens))),
        retryAfter: Number(retryAfter),
    };
}

