## Prisma

Prisma is configured at the repository root for the shared PostgreSQL database. The schema mirrors
the `backup_ecommerce.sql` tables and maps PostgreSQL-safe types, relations, indexes, and soft-delete
columns. Each service has its own Prisma client entry point under `src/config/prisma.js`.

1. Copy `.env.example` to `.env` and update `DATABASE_URL`.
2. Install dependencies with `npm install`.
3. Generate the Prisma Client with `npm run prisma:generate`.
4. Apply the schema to PostgreSQL with `npm run prisma:migrate -- --name init_postgresql`.

Useful commands:

```text
npm run prisma:validate
npm run prisma:format
npm run prisma:migrate -- --name <migration-name>
```

Product read endpoints use the Prisma-backed controller in
`services/product-service/src/controllers/prisma-fetch.controller.js`; remaining write flows can be
migrated service-by-service without changing public route contracts.