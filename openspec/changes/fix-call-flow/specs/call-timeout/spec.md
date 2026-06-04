## ADDED Requirements

### Requirement: Server timeout for unanswered calls
The signaling server SHALL automatically cancel calls that are not answered within 30 seconds.

#### Scenario: Call times out
- **WHEN** a `call:request` is received and the call is not accepted within 30 seconds
- **THEN** the server resets the kiosk status to `idle`
- **THEN** the server sends `call:ended { callId, reason: 'timeout' }` to the kiosk
- **THEN** the server broadcasts updated kiosk state to operators

#### Scenario: Call accepted before timeout
- **WHEN** a `call:accept` is received for a call before the 30-second timeout
- **THEN** the timeout is cleared and does not fire

#### Scenario: Call ended before timeout
- **WHEN** a `call:end` is received for a call before the 30-second timeout
- **THEN** the timeout is cleared and does not fire

#### Scenario: Kiosk disconnects before timeout
- **WHEN** the kiosk disconnects while a call is pending
- **THEN** any pending timeouts for that kiosk are cleaned up

### Requirement: Cleanup of kiosk:cancel handler
The server SHALL remove the `kiosk:cancel` event handler and handle all call cancellations through `call:end`.

#### Scenario: kiosk:cancel removed
- **WHEN** the server starts
- **THEN** there is no `kiosk:cancel` event listener

#### Scenario: call:end handles cancellation
- **WHEN** a `call:end` event is received for a call not in `state.calls` (never accepted)
- **THEN** the server resets the kiosk status to `idle`
- **THEN** the server sends `call:ended { callId, reason }` back to the sender
