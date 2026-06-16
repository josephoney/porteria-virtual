import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, TypedSocket } from '../types.js';
import type { SignalingState } from '../state.js';

export function registerWebRTCHandlers(
  socket: TypedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  socket.on('webrtc:offer', ({ callId, offer }) => {
    const call = state.calls.get(callId);
    if (!call) return;

    const targetId =
      socket.id === call.kioskSocketId ? call.operatorSocketId : call.kioskSocketId;

    io.to(targetId).emit('webrtc:offer', { callId, offer });
  });

  socket.on('webrtc:answer', ({ callId, answer }) => {
    const call = state.calls.get(callId);
    if (!call) return;

    const targetId =
      socket.id === call.operatorSocketId ? call.kioskSocketId : call.operatorSocketId;

    io.to(targetId).emit('webrtc:answer', { callId, answer });
  });

  socket.on('webrtc:ice-candidate', ({ callId, candidate }) => {
    const call = state.calls.get(callId);
    if (!call) return;

    const targetId =
      socket.id === call.kioskSocketId ? call.operatorSocketId : call.kioskSocketId;

    io.to(targetId).emit('webrtc:ice-candidate', { callId, candidate });
  });
}
