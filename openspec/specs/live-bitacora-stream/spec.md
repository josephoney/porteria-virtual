# live-bitacora-stream Specification

## Purpose
TBD - created by archiving change live-bitacora-stream. Update Purpose after archive.
## Requirements
### Requirement: Server announces new bitacora entries

The server SHALL publish an event for every bitacora entry it writes, scoped to the community of that entry.

#### Scenario: A movement is published

- WHEN any part of the system writes a bitacora entry
- THEN the server publishes an event with the community, the entry id, the type and the timestamp
- AND the publication happens on the write path, so no caller can skip it

#### Scenario: Events stay inside the community

- WHEN a subscriber listens for a community
- THEN it only receives the events of that community
- AND events of another community are not delivered

### Requirement: Stream subscription

The dashboard SHALL receive those events over an authenticated HTTP stream.

#### Scenario: Authorized subscriber

- WHEN a guard, a community admin or an org admin opens the stream for a community in their scope
- THEN the connection stays open
- AND each new entry arrives as an `entry` event

#### Scenario: Anonymous or foreign community

- WHEN the request has no valid session
- THEN the server rejects it without opening the stream
- AND when the user belongs to another community, the server answers `403`

#### Scenario: The connection is kept alive

- WHEN no entry is written for a while
- THEN the server sends a heartbeat so proxies do not close the connection

### Requirement: Live refresh in the board

The board SHALL refresh when an event arrives instead of waiting for the poll.

#### Scenario: A scan appears immediately

- WHEN the guard confirms a scan in the app
- THEN the access table of the dashboard shows the new row without a manual refresh
- AND the user does not lose filters or the current page

#### Scenario: Opening or closing a shift refreshes the history

- WHEN a shift starts or ends
- THEN the shift history of the guard panel reloads
- AND the bitacora of the access table reloads too

#### Scenario: The fallback poll stays as a net

- WHEN the stream drops or an event is lost
- THEN the board still refreshes through the fallback poll
- AND the fallback interval is 30 seconds

#### Scenario: Nothing new means nothing changes

- WHEN the fallback poll runs and the total did not change
- THEN the table is not refetched
- AND the visible rows stay untouched

#### Scenario: Unmounting closes the stream

- WHEN the user leaves the board
- THEN the stream is aborted
- AND the reconnect timer is cleared

