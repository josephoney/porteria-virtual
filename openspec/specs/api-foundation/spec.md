## Purpose

HTTP API foundation: Fastify, error handling, health checks and internal API conventions.

## Requirements

### Requirement: Config module
The API server SHALL have a typed configuration module that reads environment variables and validates required values at startup.

#### Scenario: All required variables present
- **WHEN** the server starts with all required environment variables set
- **THEN** the config object is populated with typed values

#### Scenario: Missing required variable
- **WHEN** `JWT_SECRET` is not set
- **THEN** the server throws a descriptive error at startup and exits

### Requirement: Error handler plugin
The API SHALL have a centralized error handler that formats all errors as JSON with consistent structure.

#### Scenario: Validation error
- **WHEN** a request fails Zod validation
- **THEN** the response has status 400 with `{ statusCode: 400, error: "Bad Request", message: "..." }`

#### Scenario: Not found error
- **WHEN** a route does not exist
- **THEN** the response has status 404 with `{ statusCode: 404, error: "Not Found", message: "Route not found" }`

#### Scenario: Internal server error
- **WHEN** an unhandled exception occurs
- **THEN** the response has status 500 with `{ statusCode: 500, error: "Internal Server Error", message: "..." }`
- **THEN** the error stack trace is logged but not included in the response

### Requirement: CORS configuration
The API server SHALL enable CORS for all origins in development and restrict to configured origins in production.

#### Scenario: Preflight request
- **WHEN** an OPTIONS request is made to any route
- **THEN** the response includes appropriate CORS headers

#### Scenario: Cross-origin request
- **WHEN** a request is made from a different origin
- **THEN** the response includes `Access-Control-Allow-Origin` header

### Requirement: Database integration
The API server SHALL use `@porteria/database` for all database operations.

#### Scenario: Database connection on startup
- **WHEN** the server starts
- **THEN** a database connection is established using environment variables
- **THEN** the server logs "Database connected"

#### Scenario: Database connection failure
- **WHEN** PostgreSQL is not reachable
- **THEN** the server logs the error and exits with code 1
