# Backend Guidelines

## Architecture
All backends use a two-layer architecture:

- **API layer** — GraphQL resolvers (Apollo Server on Express). Resolvers map operations to interactions; no business logic or direct DB access in resolvers.
- **Service layer** — `interactions/` folder. Interactions are single-responsibility functions grouped by primary resource. They access data through Prisma ORM.
  - Keep interactions small and composable. Prefer several focused interactions calling each other over one large one.
  - When writing a new Prisma query in an interaction, verify it is covered by an existing index in `schema.prisma`. Add indexes if needed (see Database section).

## Build & run
- Never use `npm run dev`. Always use `npm run build` then `npm start`.
- `npm run dev` does not reload changes reliably and can hide syntax errors.

## Database (Prisma)
- Prisma (`schema.prisma`) is used in all backend repos. `commerce-platform-scrapers` introspects rather than owning migrations — see that repo's CLAUDE.md.
- All database changes must be explicitly mentioned in implementation plans with exact table and column names before being applied.
- Make schema changes in `schema.prisma` first, then run: `npx prisma migrate dev --name "<meaningful-name>"`.
- For index types Prisma cannot express (e.g. GIN), generate an empty migration with `--create-only`, add raw SQL, mark the index as externally managed in the schema, then apply.
- Never reset the database. If Prisma reports a mismatch that requires a reset, stop and delegate to a human — unless you introduced the mismatch yourself in the current session.
- Do not create concurrent indexes — Prisma migrations do not support them and the migration will fail.

## GraphQL
- After any change to `schema.graphql`, run `npm run codegen` to regenerate types.
- Never use the `ID` scalar type; use `EncodedID` instead.
- Check existing GraphQL clients (e.g. `surge.ts`, `messagingService.ts`) before creating new inter-service communication.

## Permissions
- All backends use a User / Role / Resource / Permission model with a `UserRole` association table.
- `read` and `write` cover most cases; use more granular permissions (`readOwn`, `readAny`, `delete`, `assign`) where it makes sense.
- Always include the proposed resource and permission in the implementation plan.

## Logging
- Use the `logger` function instead of `console.log` in all backends (all log levels).
