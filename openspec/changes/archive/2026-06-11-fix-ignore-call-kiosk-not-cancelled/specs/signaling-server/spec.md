## MODIFIED Requirements

### Requirement: Call end handling
The signaling server SHALL handle `call:end` events from any peer and forward `call:ended` to the counterpart.

#### Scenario: Kiosk cancels before operator accepts
- **WHEN** a kiosk emits `call:end` and the call is not in `state.calls`
- **THEN** the kiosk status is reset to `idle`
- **THEN** `call:ended` is emitted to the kiosk and to all operators

#### Scenario: Operator cancels before accepting (with buildingId)
- **WHEN** an operator emits `call:end` with `{ callId, buildingId }` and the call is not in `state.calls`
- **THEN** the kiosk identified by `buildingId` has its status reset to `idle`
- **THEN** `call:ended` with reason `cancelled` is emitted to that kiosk
- **THEN** `call:ended` is emitted to all operators

#### Scenario: Either peer cancels during active call
- **WHEN** either peer emits `call:end` and the call exists in `state.calls`
- **THEN** `call:ended` is forwarded to the other peer
- **THEN** the call is removed from `state.calls`
- **THEN** the kiosk status is reset to `idle`

#### Scenario: Operator cancels without buildingId and call not assigned
- **WHEN** an operator emits `call:end` without `buildingId` and the call is not in `state.calls`
- **THEN** `call:ended` is emitted to the operator and to all operators
- **THEN** no kiosk is notified (backward compatible behavior)
