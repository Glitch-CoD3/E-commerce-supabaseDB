import prisma from "./prisma.js";

const createQuery = (client) => async (sql, parameters = []) => {
    let index = 0;
    const statement = sql
        .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
        .replace(/\bNOW\s*\(\s*\)/gi, "CURRENT_TIMESTAMP")
        .replace(/\?/g, () => `$${++index}`);
    const command = statement.trim().split(/\s+/)[0].toUpperCase();
    if (command === "SELECT" || command === "WITH") {
        return [await client.$queryRawUnsafe(statement, ...parameters)];
    }
    if (command === "INSERT") {
        const rows = await client.$queryRawUnsafe(`${statement.trim().replace(/;$/, "")} RETURNING id`, ...parameters);
        return [{ insertId: rows[0]?.id }];
    }
    return [{ affectedRows: await client.$executeRawUnsafe(statement, ...parameters) }];
};

const getConnection = async () => {
    const query = createQuery(prisma);
    return {
        query,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {}
    };
};

const DB = { promise: () => ({ query: createQuery(prisma), getConnection }) };

export default DB;
