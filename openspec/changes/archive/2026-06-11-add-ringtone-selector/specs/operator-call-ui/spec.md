## MODIFIED Requirements

### Requirement: Incoming call ring sound
The dashboard SHALL play the operator's selected ringtone when a new call arrives and stop it when the call is handled.

#### Scenario: Ring starts on incoming call with selected ringtone
- **WHEN** a `call:incoming` event is received
- **THEN** the ringtone selected by the operator starts playing in a loop
- **THEN** the ringtone is the one identified by `localStorage.getItem('ringtone')` or 'classic' if not set

#### Scenario: Ring stops on call accepted
- **WHEN** the operator clicks "Contestar" on a call
- **THEN** the ring audio stops immediately

#### Scenario: Ring stops on call taken by another operator
- **WHEN** a `call:taken` event is received
- **THEN** the ring audio stops

#### Scenario: Ring stops on call cancelled or timed out
- **WHEN** a `call:ended` event is received
- **THEN** the ring audio stops

#### Scenario: Ringtone changed while ringing
- **WHEN** the operator changes the ringtone selection while a ring is actively playing
- **THEN** the current ring continues with the previously selected ringtone
- **THEN** the next incoming call uses the newly selected ringtone
