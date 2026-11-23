## ADDED Requirements

### Requirement: A pass binds to the first device that opens it

A public pass link SHALL bind to the first device that opens it. Once bound, the
same link SHALL only authorize that device, and SHALL NOT authorize any other.

#### Scenario: First open binds the device
- **WHEN** a device opens a pass link for the first time
- **THEN** the pass records the device and the request authorizes the pass

#### Scenario: A forwarded link is rejected on another device
- **WHEN** a different device opens an already bound pass link
- **THEN** the request is rejected with `device_already_bound`
- **AND** the original device keeps its access

### Requirement: Several passes coexist on one device

A device SHALL be able to hold more than one pass at the same time. Opening a
pass SHALL NOT cancel, revoke or invalidate any other pass previously opened on
that device.

#### Scenario: Opening a second pass keeps the first valid
- **WHEN** a device that already holds pass A opens pass B
- **THEN** pass B is bound to that device
- **AND** pass A still authorizes the same device
- **AND** no pass returns `not_bound` because of the new one

#### Scenario: Each pass keeps its own device
- **WHEN** pass A is bound to device 1 and pass B is bound to device 2
- **THEN** device 1 only authorizes pass A
- **AND** device 2 only authorizes pass B
- **AND** neither device gains access to the other pass

#### Scenario: Reopening a previous pass still works
- **WHEN** a device opens pass A, then pass B, then pass A again
- **THEN** all three requests authorize the corresponding pass
- **AND** the binding of pass A is not reassigned to a different device

### Requirement: The device can list the passes it holds

The system SHALL expose the passes bound to the current device, so the holder
can reach each one without keeping several tabs open.

The index SHALL be resolved from the bindings the device presents with the
request. It SHALL NOT depend on a stored device identifier, because the server
only keeps a hash of each pass's device key and cannot look a device up.

The index SHALL be a list, not a mosaic: each pass opens its own QR screen, one
at a time, so the code keeps its full size for the guard to scan.

#### Scenario: Listing the passes of a device
- **WHEN** a bound device requests its pass index
- **THEN** the response lists each pass with its public link, its holder name, its
  destination and its current ticket state
- **AND** the response never includes another device's passes

#### Scenario: The index uses the presented bindings
- **WHEN** a device requests its pass index
- **THEN** the server resolves the list from the per-pass bindings present in the
  request
- **AND** it returns nothing for a pass whose binding the device does not present

#### Scenario: Each pass opens on its own screen
- **WHEN** the holder picks a pass from the index
- **THEN** the app shows that pass's QR at full size
- **AND** the index remains one tap away to return to the other passes

#### Scenario: Passes that no longer authorize are hidden
- **WHEN** a pass in the index is revoked, expired or used up
- **THEN** the index does not offer it as an actionable pass
- **AND** the pass remains visible only as history, never as an active QR

#### Scenario: A device with no passes gets an empty index
- **WHEN** a device that never opened a pass requests its pass index
- **THEN** the response is an empty list, not an error

### Requirement: The previous binding keeps working during the transition

A device bound with the previous single-pass cookie SHALL keep its access after
upgrade, without opening the link again.

#### Scenario: Device with the previous cookie
- **WHEN** a device presents only the legacy binding for a pass
- **THEN** that pass still authorizes the device
- **AND** the next request writes the new per-pass binding so the device stops
  depending on the legacy cookie

### Requirement: The binding never weakens the scan rules

Multiple coexisting passes SHALL NOT change how a pass is scanned, confirmed or
counted. Each pass keeps its own token, its own remaining uses and its own audit
trail.

#### Scenario: Scanning two passes of the same device
- **WHEN** the guard scans pass A and confirms the entry
- **THEN** only pass A records the entry and consumes a use
- **AND** pass B keeps its own state untouched
