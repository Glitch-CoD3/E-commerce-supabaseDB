import prisma from "./prisma.js";

const toPostgres = (sql, values) => ({
    sql: sql
        .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
        .replace(/\bNOW\s*\(\s*\)/gi, "CURRENT_TIMESTAMP")
        .replace(/\?/g, () => `$${values.shift()}`),
    values
});

const query = async (sql, parameters = []) => {
    const values = parameters.map((value) => value);
    const command = sql.trim().split(/\s+/)[0].toUpperCase();
    const bound = toPostgres(sql, values.map((_, index) => index + 1));
    if (command === "SELECT" || command === "WITH") {
        return [await prisma.$queryRawUnsafe(bound.sql, ...values)];
    }
    if (command === "INSERT") {
        const rows = await prisma.$queryRawUnsafe(`${bound.sql.trim().replace(/;$/, "")} RETURNING id`, ...values);
        return [{ insertId: rows[0]?.id }];
    }
    return [{ affectedRows: await prisma.$executeRawUnsafe(bound.sql, ...values) }];
};

const getConnection = async () => {
    await prisma.$connect();
    return {
        query,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {}
    };
};

const DB = { promise: () => ({ query, getConnection }) };

export default DB;
