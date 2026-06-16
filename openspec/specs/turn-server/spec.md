# TURN Server

## Purpose

Provides a Coturn STUN/TURN server as a Docker service for WebRTC NAT traversal, enabling video/audio relay when direct P2P connections fail due to symmetric NATs.

## ADDED Requirements

### Requirement: Coturn Docker service
The docker-compose SHALL include a coturn service running on `network_mode: host` with the configuration from `docker/coturn/turnserver.conf`.

#### Scenario: Coturn starts
- **WHEN** `docker compose up -d` is run
- **THEN** the coturn container starts and listens on port 3478/udp for STUN/TURN
- **THEN** the coturn container listens on port 5349/tcp for TLS

#### Scenario: Coturn relay range
- **WHEN** media traffic needs to be relayed through TURN
- **THEN** coturn allocates ports from the range 49152-49200/udp

#### Scenario: Coturn credentials
- **WHEN** a WebRTC client connects to TURN
- **THEN** authentication uses username `porteria` and password from `turnserver.conf`

### Requirement: Coturn configuration file
The existing `docker/coturn/turnserver.conf` SHALL be valid and mounted into the coturn container.

#### Scenario: Config mounted read-only
- **WHEN** the coturn container starts
- **THEN** `docker/coturn/turnserver.conf` is mounted at `/etc/coturn/turnserver.conf`
- **THEN** the configuration is read-only (container cannot modify it)
