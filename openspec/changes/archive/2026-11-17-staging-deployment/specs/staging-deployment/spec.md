# Spec delta: staging deployment

## ADDED Requirements

### Requirement: One command brings the stack up

The repository SHALL provide a compose file that starts the database, the API and the web apps behind a single proxy.

#### Scenario: First deployment

- WHEN the server has the repository and a filled `.env.staging`
- THEN one command builds and starts every service
- AND the API is reachable only through the proxy

#### Scenario: Only the proxy is public

- WHEN the stack is running
- THEN only ports 80 and 443 are published
- AND the database is not reachable from outside the host

### Requirement: The domain is configuration, not code

The deployment SHALL take the domain from the environment so the same files serve staging and production.

#### Scenario: Changing the domain

- WHEN the operator changes the domain variable
- THEN the proxy serves the new domain after a restart
- AND no file in the repository needs editing

#### Scenario: Certificates are automatic

- WHEN the DNS record points to the server
- THEN the proxy obtains and renews the certificate without manual steps

### Requirement: Migrations run before the API serves traffic

The deployment SHALL apply pending migrations as part of the start, and refuse to start the API when they fail.

#### Scenario: A deploy with a new migration

- WHEN a version with a new migration is deployed
- THEN the migrations run to completion first
- AND the API starts only afterwards

#### Scenario: A failing migration stops the deploy

- WHEN a migration fails
- THEN the API does not start
- AND the failure is visible in the migration service logs

### Requirement: The web apps keep their routes

Each web app SHALL keep working when opened directly on a deep route.

#### Scenario: Deep link to the dashboard

- WHEN a user opens an internal dashboard route directly
- THEN the app loads instead of a server error

#### Scenario: Public pass link

- WHEN a visitor opens a pass link
- THEN the pass page loads over HTTPS

#### Scenario: Kiosk under its prefix

- WHEN the kiosk is opened
- THEN it loads its assets from its own prefix
- AND the camera works because the site is served over HTTPS

### Requirement: Live events are not buffered

The proxy SHALL forward server-sent events without waiting for the buffer to fill.

#### Scenario: A movement appears immediately

- WHEN a scan is confirmed while the board is open
- THEN the row appears within a second
- AND it does not wait for the fallback poll
