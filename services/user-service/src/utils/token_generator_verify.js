import jwt from 'jsonwebtoken';

const normalizeId = (id) => {
    if (typeof id === 'bigint') {
        return id.toString();
    }

    if (typeof id === 'number') {
        return String(id);
    }

    if (typeof id === 'string') {
        return id;
    }

    throw new TypeError(`Invalid ID type: ${typeof id}`);
};

const generate_refresh_token = (user_id, name, email, role_id, sessionId) => {
    return jwt.sign(
        {
            id: normalizeId(user_id),
            name: name,
            email: email,
            role_id: normalizeId(role_id),
            session_id: normalizeId(sessionId)
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '7d'
        }
    );
};

const generate_access_token = (user_id, name, email, role_id) => {

    return jwt.sign(
        {
            id: normalizeId(user_id),
            name: name,
            email: email,
            role_id: normalizeId(role_id),
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '15m'
        }
    );
};

export { generate_refresh_token, generate_access_token };