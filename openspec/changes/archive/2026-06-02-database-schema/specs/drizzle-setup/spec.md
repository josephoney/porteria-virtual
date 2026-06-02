## ADDED Requirements

### Requirement: Drizzle ORM package
The project SHALL have a `packages/database/` package with Drizzle ORM installed and configured for PostgreSQL + TimescaleDB.

#### Scenario: Package is installable
- **WHEN** developer runs `pnpm install` from the project root
- **THEN** `packages/database/node_modules/` contains `drizzle-orm` and `drizzle-kit`

#### Scenario: Database connection resolves from env
- **WHEN** `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` are set in `.env`
- **THEN** the database connection utility connects to PostgreSQL successfully

#### Scenario: TypeScript types are importable
- **WHEN** another package imports from `@porteria/database`
- **THEN** TypeScript resolves the package and provides autocompletion for all exported types

### Requirement: Drizzle Kit configuration
The project SHALL have a `drizzle.config.ts` file that points to the schema files and database connection.

#### Scenario: Generate migration
- **WHEN** developer runs `pnpm --filter @porteria/database db:generate`
- **THEN** drizzle-kit generates SQL migration files in a `migrations/` directory

#### Scenario: Apply migration
- **WHEN** developer runs `pnpm --filter @porteria/database db:migrate`
- **THEN** all tables are created in the PostgreSQL database

### Requirement: Database connection utility
The package SHALL export a function that creates a Drizzle client connected to PostgreSQL using environment variables.

#### Scenario: Connection with env vars
- **WHEN** `.env` contains valid PostgreSQL credentials
- **THEN** calling the connection function returns a working Drizzle client
- **THEN** the client can execute queries against the database

#### Scenario: Missing connection parameters
- **WHEN** required environment variables are not set
- **THEN** the connection utility throws a descriptive error indicating which variables are missing
