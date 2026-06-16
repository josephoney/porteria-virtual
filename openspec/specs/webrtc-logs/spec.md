# WebRTC Logs

## Purpose

Provides detailed console logging at each step of the WebRTC handshake (offer, answer, ICE candidates, connection state) in both kiosk and dashboard to facilitate debugging of video transmission issues.

## ADDED Requirements

### Requirement: WebRTC offer logs
The kiosk SHALL log detailed information when creating and sending a WebRTC offer.

#### Scenario: Offer created
- **WHEN** `createAndSendOffer` is called
- **THEN** the console logs: `[WebRTC] Creating offer, localStream tracks: N`
- **WHEN** the offer is sent
- **THEN** the console logs: `[WebRTC] Offer sent for callId: X`

### Requirement: WebRTC answer logs
The kiosk SHALL log when a WebRTC answer is received and set.

#### Scenario: Answer received
- **WHEN** a `webrtc:answer` event is received
- **THEN** the console logs: `[WebRTC] Answer received for callId`
- **WHEN** the remote description is set successfully
- **THEN** the console logs: `[WebRTC] Remote description set`

### Requirement: WebRTC ICE candidate logs
The kiosk and dashboard SHALL log ICE candidate events.

#### Scenario: Local ICE candidate
- **WHEN** an ICE candidate is generated locally and sent
- **THEN** the console logs: `[WebRTC] Local ICE candidate sent`

#### Scenario: Remote ICE candidate
- **WHEN** an ICE candidate is received and added
- **THEN** the console logs: `[WebRTC] Remote ICE candidate added`

### Requirement: WebRTC connection state logs
The kiosk and dashboard SHALL log connection state changes.

#### Scenario: Connection state changes
- **WHEN** the RTCPeerConnection state changes
- **THEN** the console logs: `[WebRTC] Connection state: X, ICE state: Y, Signaling state: Z`

### Requirement: Dashboard WebRTC logs
The dashboard SHALL log equivalent WebRTC events for the receiver side.

#### Scenario: Offer received
- **WHEN** the dashboard receives a `webrtc:offer`
- **THEN** the console logs: `[WebRTC-Dashboard] Offer received for callId, creating answer`

#### Scenario: Answer sent
- **WHEN** the dashboard sends a `webrtc:answer`
- **THEN** the console logs: `[WebRTC-Dashboard] Answer sent for callId`
