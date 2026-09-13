## Prisma

Prisma is configured at the repository root for the shared MySQL database.

1. Copy `.env.example` to `.env` and update `DATABASE_URL`.
2. Install dependencies with `npm install`.
3. Generate the Prisma Client with `npm run prisma:generate`.

Useful commands:

```text
npm run prisma:validate
npm run prisma:format
npm run prisma:migrate -- --name <migration-name>
```

The existing services still use their current MySQL query layer. Prisma can be introduced service-by-service after the database schema has been introspected or defined in `prisma/schema.prisma`.