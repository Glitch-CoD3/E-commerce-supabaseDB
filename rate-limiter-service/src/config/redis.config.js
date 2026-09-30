import { Redis } from "@upstash/redis"


export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});


// Atomic token bucket: refill + consume in one step
export const TOKEN_BUCKET_LUA = `
    local key        = KEYS[1]
    local capacity   = tonumber(ARGV[1])
    local refillRate = tonumber(ARGV[2])
    local now        = tonumber(ARGV[3])

    local data   = redis.call('HMGET', key, 'tokens', 'ts')
    local tokens = tonumber(data[1])
    local ts     = tonumber(data[2])

    if tokens == nil then
        tokens = capacity
        ts = now
    end

    local elapsed = math.max(0, now - ts) / 1000
    tokens = math.min(capacity, tokens + elapsed * refillRate)

    local allowed = 0
    local retryAfter = 0
    if tokens >= 1 then
        tokens = tokens - 1
        allowed = 1
    else
        retryAfter = math.ceil((1 - tokens) / refillRate)
    end

    redis.call('HSET', key, 'tokens', tostring(tokens), 'ts', tostring(now))

    -- TTL = time to refill from empty to full, plus 1s margin
    redis.call('PEXPIRE', key, math.ceil(capacity / refillRate * 1000) + 1000)

    return { allowed, tostring(tokens), retryAfter }
`;