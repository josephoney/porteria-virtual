# pass-ticket Specification

## Purpose

Define the ticket a visitor sees for a pass: a single state derived from the pass
data, shown with the same label, color and icon on every surface. The state tells
the holder whether the pass is ready to enter, whether the visitor is inside, how
many uses remain or whether the pass can no longer be used. It is informational
and never changes how the guard scans or confirms.

## Requirements

### Requirement: The ticket state comes from the pass

The ticket SHALL derive its state from the pass data (`status`, `presence_state`, `entry_count`, `exit_count`, `max_uses`, `recurrence`, `valid_until`, `rule.remaining_uses`), never from the QR token or the local rotation timer.

#### Scenario: Rotating the QR does not reset the state

- **WHEN** the dynamic QR rotates while the visitor is inside
- **THEN** the ticket keeps showing the inside state

#### Scenario: A new token keeps the same state

- **WHEN** a new QR token is generated for a pass that already has a confirmed entry
- **THEN** the ticket still shows the inside state

### Requirement: Pending entry

The ticket SHALL show the green state «Pendiente de ingreso» when an entry/exit pass is active, the visitor is outside, and at least one use remains.

#### Scenario: Active pass outside

- **WHEN** an active entry/exit pass is outside with remaining uses
- **THEN** the ticket shows the green pending entry state

### Requirement: Inside

The ticket SHALL show the orange state «Adentro · esperando salida» while an entry/exit pass has a confirmed entry and no confirmed exit.

#### Scenario: Entry confirmed

- **WHEN** the guard confirms the entry
- **THEN** the ticket switches to the orange inside state until the exit is confirmed

### Requirement: Re-entry after exit

The ticket SHALL show the green state «Puede volver a entrar» with the remaining uses when an entry/exit pass completes a cycle and still has uses.

#### Scenario: Multi-use pass after exit

- **WHEN** the exit is confirmed and the pass still has uses
- **THEN** the ticket shows the green re-entry state and the remaining uses

### Requirement: No uses left today

The ticket SHALL show a red «Sin usos hoy» state for an active range or weekly pass that has no uses left on the current local day. It SHALL NOT label the pass as "Usado", because the pass becomes available again on the next allowed day.

#### Scenario: Daily uses exhausted

- **WHEN** a range or weekly pass is active, outside, and its remaining uses today are zero
- **THEN** the ticket shows the red «Sin usos hoy» state

#### Scenario: Uses re-enabled on the next allowed day

- **WHEN** the local day changes, or the next authorized entry window starts, and the pass is still active
- **THEN** the ticket returns to the green «Pendiente de ingreso» state with the uses available for that day

### Requirement: Final states

The ticket SHALL show a final state when the pass cannot be used again: «Usado» for a consumed pass, «Vencido» for an expired one, and «Revocado» for a revoked one.

#### Scenario: Entry-only pass consumed

- **WHEN** an entry-only pass is confirmed
- **THEN** the ticket shows «Usado» and the QR no longer authorizes an entry

#### Scenario: Single-use pass exits

- **WHEN** a once-only entry/exit pass completes its exit
- **THEN** the ticket shows «Usado»

#### Scenario: Expired pass

- **WHEN** the pass is past `valid_until` or its status is expired
- **THEN** the ticket shows «Vencido»

#### Scenario: Revoked pass

- **WHEN** the resident revokes the pass
- **THEN** the ticket shows «Revocado»

### Requirement: Accessible signals

The ticket SHALL combine the color with an icon and a text label. Color MUST NOT be the only signal.

#### Scenario: Color-blind reader

- **WHEN** the ticket renders any state
- **THEN** the icon and label identify the state without relying on color

### Requirement: Consistent surfaces

The mobile pass detail and the public pass web page SHALL show the same state for the same pass.

#### Scenario: Same pass in both surfaces

- **WHEN** the same pass is opened in the mobile app and on the public web page
- **THEN** both show the same label and color

### Requirement: State is informational

The ticket state SHALL NOT change the scan or confirmation rules; the server remains the authority.

#### Scenario: Guard scans an inside pass

- **WHEN** the guard scans a pass whose ticket shows «Adentro · esperando salida»
- **THEN** the scan and confirmation flow behaves exactly as before
