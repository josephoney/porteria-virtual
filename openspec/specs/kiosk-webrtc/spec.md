## Purpose

WebRTC media flow between the kiosk and the operator dashboard.

## Requirements

### Requirement: Camera and microphone access
The kiosk SHALL request camera and microphone access when initiating a call.

#### Scenario: Media access granted
- **WHEN** the user presses the call button
- **THEN** the browser requests camera and microphone permission
- **THEN** on grant, the local video stream is attached to the local video element

#### Scenario: Media access denied
- **WHEN** the browser denies camera or microphone access
- **THEN** the error is logged to console
- **THEN** the call proceeds with audio-only or shows an error

### Requirement: WebRTC peer connection
The kiosk SHALL create an RTCPeerConnection with configured ICE servers when the operator accepts the call.

#### Scenario: Peer connection created
- **WHEN** a `call:accepted` event is received
- **THEN** an RTCPeerConnection is created with ICE servers from config
- **THEN** the local media stream tracks are added to the connection
- **THEN** an SDP offer is created and sent via Socket.io `webrtc:offer`

#### Scenario: Remote stream received
- **WHEN** the remote peer's media tracks arrive
- **THEN** the remote video element displays the operator's video

#### Scenario: ICE candidate exchange
- **WHEN** the local peer generates an ICE candidate
- **THEN** it is sent to the signaling server via `webrtc:ice-candidate`
- **WHEN** a remote ICE candidate is received
- **THEN** it is added to the peer connection

### Requirement: WebRTC cleanup
The kiosk SHALL properly close peer connections and stop media tracks when a call ends.

#### Scenario: Call ended by operator
- **WHEN** a `call:ended` event is received
- **THEN** the RTCPeerConnection is closed
- **THEN** the remote video element's srcObject is set to null
- **THEN** the UI returns to idle screen
- **THEN** the call timer is stopped and reset

#### Scenario: Call ended by kiosk
- **WHEN** the user presses the hang-up button
- **THEN** a `call:end` event is emitted via Socket.io
- **THEN** the RTCPeerConnection is closed and tracks stopped
- **THEN** the UI returns to idle screen

### Requirement: WebRTC connection state monitoring
The kiosk SHALL log WebRTC connection state changes.

#### Scenario: Connection state change
- **WHEN** the RTCPeerConnection state changes
- **THEN** the new state is logged to console with `[WebRTC]` prefix
