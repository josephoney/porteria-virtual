# ringtone-definitions Specification

## Purpose
TBD - created by archiving change add-ringtone-selector. Update Purpose after archive.
## Requirements
### Requirement: Ringtone definitions registry
The system SHALL provide a registry of 8-10 predefined ringtones, each defined by oscillator voices and a rhythmic pattern, accessible by unique ID.

#### Scenario: Retrieve ringtone by ID
- **WHEN** `getRingtoneDefinition('classic')` is called
- **THEN** the ringtone definition is returned with id, name, voices array, and pattern array

#### Scenario: Missing ringtone falls back to default
- **WHEN** `getRingtoneDefinition('nonexistent')` is called
- **THEN** `undefined` is returned and the caller uses the default ringtone

#### Scenario: All ringtones have unique IDs
- **WHEN** iterating over `RINGTONE_DEFINITIONS`
- **THEN** no two ringtones share the same `id`

### Requirement: Ringtone player engine
The system SHALL play a ringtone definition in a continuous loop using the Web Audio API, with start and stop control.

#### Scenario: Start ringtone playback
- **WHEN** `createRingPlayer(def).start()` is called
- **THEN** an AudioContext is created and the ringtone pattern begins playing in a loop
- **THEN** the pattern cycles through ON/OFF steps as defined, creating and destroying oscillators at each ON step

#### Scenario: Stop ringtone playback
- **WHEN** `createRingPlayer(def).stop()` is called during active playback
- **THEN** the AudioContext is closed and all pending timeouts are cleared
- **THEN** no further oscillator nodes are created

#### Scenario: Start is idempotent while already playing
- **WHEN** `start()` is called while the player is already active
- **THEN** the existing playback continues without creating a second AudioContext or overlay

#### Scenario: Multiple voices play simultaneously
- **WHEN** a ringtone has two voices (e.g., sine 800Hz + sine 1000Hz)
- **THEN** both oscillators are created, connected to separate GainNodes, and start simultaneously during each ON step

#### Scenario: AudioContext creation failure is silent
- **WHEN** `new AudioContext()` throws (e.g., browser policy restriction)
- **THEN** no error propagates to the caller and no sound is produced

### Requirement: Ringtone preview
The system SHALL allow playing a ringtone once (non-looping) for preview purposes without affecting the active ring.

#### Scenario: Preview plays pattern once
- **WHEN** `previewRingtone(def)` is called
- **THEN** a temporary AudioContext is created
- **THEN** the ringtone pattern is played exactly once from first ON step to last OFF step
- **THEN** the AudioContext is closed after the final step completes

#### Scenario: Consecutive previews cancel previous
- **WHEN** `previewRingtone(defA)` is called and then `previewRingtone(defB)` is called before A finishes
- **THEN** preview A is cancelled (timeout cleared, context closed)
- **THEN** only preview B is heard

### Requirement: Ringtone persistence
The system SHALL persist the selected ringtone ID in localStorage and load it on initialization.

#### Scenario: Save ringtone selection
- **WHEN** the operator selects a ringtone with ID 'digital'
- **THEN** `localStorage.setItem('ringtone', 'digital')` is called

#### Scenario: Load ringtone selection on startup
- **WHEN** the application initializes and localStorage contains `ringtone = 'digital'`
- **THEN** the selected ringtone ID is set to 'digital'

#### Scenario: Fallback when no selection saved
- **WHEN** the application initializes and localStorage has no `ringtone` key
- **THEN** the selected ringtone ID defaults to 'classic'

#### Scenario: Fallback when saved ID is invalid
- **WHEN** localStorage contains `ringtone = 'nonexistent'`
- **THEN** the selected ringtone ID falls back to 'classic'

