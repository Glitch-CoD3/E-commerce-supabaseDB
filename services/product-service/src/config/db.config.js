import prisma from "./prisma.js";

// Keep the small query interface used by the controllers while routing every
// operation through Prisma's PostgreSQL client.
const bindParameters = (sql, values) => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

const normalizeSql = (sql) => sql
  .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
  .replace(/\bNOW\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");

const query = async (sql, values = []) => {
  const statement = normalizeSql(sql);
  const bound = bindParameters(statement, values);
  const command = statement.trim().split(/\s+/)[0].toUpperCase();

  if (command === "SELECT" || command === "WITH") {
    const rows = await prisma.$queryRawUnsafe(bound, ...values);
    return [rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "bigint" ? Number(value) : value
      ])
    ))];
  }

  if (command === "INSERT") {
    const rows = await prisma.$queryRawUnsafe(`${bound.trim().replace(/;$/, "")} RETURNING id`, ...values);
    return [{ insertId: rows[0]?.id == null ? undefined : Number(rows[0].id) }];
  }

  const affectedRows = await prisma.$executeRawUnsafe(bound, ...values);
  return [{ affectedRows }];
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