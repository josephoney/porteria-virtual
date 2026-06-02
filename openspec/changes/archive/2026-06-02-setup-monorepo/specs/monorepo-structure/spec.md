## ADDED Requirements

### Requirement: Monorepo directory structure
The project SHALL use a monorepo structure with pnpm workspaces, organizing code into `apps/`, `packages/`, `server/`, and root-level configuration files.

#### Scenario: Developer clones the repository
- **WHEN** a developer clones the repository and runs `pnpm install`
- **THEN** all workspace packages are installed and linked
- **THEN** running `pnpm dev` from root starts all apps in development mode

#### Scenario: Adding a new app
- **WHEN** a developer creates a new directory under `apps/` with a `package.json` containing `"name": "@porteria/<app-name>"`
- **THEN** pnpm automatically includes it in the workspace without changing `pnpm-workspace.yaml`

#### Scenario: Importing shared types
- **WHEN** any app or server imports from `@porteria/shared`
- **THEN** TypeScript resolves the types correctly at compile time
- **THEN** the import works both in development (`pnpm dev`) and production build (`pnpm build`)

### Requirement: Development scripts
The root `package.json` SHALL provide convenience scripts for common monorepo operations.

#### Scenario: Starting all apps in development
- **WHEN** developer runs `pnpm dev` from the project root
- **THEN** all apps in `apps/` and servers in `server/` start concurrently
- **THEN** each app is accessible on its configured port

#### Scenario: Building for production
- **WHEN** developer runs `pnpm build` from the project root
- **THEN** all apps and servers compile successfully
- **THEN** build artifacts are placed in each package's `dist/` directory

#### Scenario: Running linting
- **WHEN** developer runs `pnpm lint` from the project root
- **THEN** ESLint checks all TypeScript files across the workspace
- **THEN** errors are reported with file and line references

### Requirement: Tooling configuration
The project SHALL have unified ESLint, Prettier, and TypeScript configurations shared across all packages.

#### Scenario: TypeScript strict mode
- **WHEN** any TypeScript file is compiled
- **THEN** strict mode is enforced (`strict: true`)
- **THEN** implicit `any` types cause compilation errors

#### Scenario: Code formatting
- **WHEN** developer runs `pnpm format` or saves a file with editor integration
- **THEN** Prettier formats the code according to the shared configuration
- **THEN** formatting is consistent across all apps and packages

#### Scenario: Linting unused variables
- **WHEN** a TypeScript file contains an unused variable
- **THEN** ESLint reports a warning or error depending on rule severity

### Requirement: Docker Compose for local infrastructure
The project SHALL provide a `docker-compose.yml` file with all required infrastructure services for local development.

#### Scenario: Starting infrastructure services
- **WHEN** developer runs `docker compose up -d` from the project root
- **THEN** PostgreSQL with TimescaleDB is available on port 5432
- **THEN** Redis is available on port 6379
- **THEN** Mosquitto MQTT broker is available on port 1883

#### Scenario: Environment configuration
- **WHEN** apps or servers need to connect to infrastructure services
- **THEN** connection strings are configurable via environment variables (`.env` files)
- **THEN** defaults point to Docker Compose services (localhost with standard ports)

### Requirement: Legacy code preservation
The existing vanilla JS code SHALL be preserved in a `legacy/` directory as functional reference.

#### Scenario: Legacy code remains accessible
- **WHEN** developer navigates to `legacy/`
- **THEN** all original files (`server.js`, `kiosk.html`, `kiosk2.html`, `operator.html`) are present and unchanged
- **THEN** the legacy signaling server can still be run independently with `node legacy/server.js`

#### Scenario: Legacy code is documented as transitional
- **WHEN** developer opens `legacy/`
- **THEN** a README file explains that this code is reference only and will be removed once the React apps reach feature parity
