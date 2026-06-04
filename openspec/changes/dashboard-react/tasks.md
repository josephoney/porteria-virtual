## 1. Auth & Routing Setup

- [x] 1.1 Create `apps/dashboard/src/contexts/AuthContext.tsx` — login against API, store token + user in state, provide login/logout/isAuthenticated
- [x] 1.2 Create `apps/dashboard/src/pages/LoginPage.tsx` — email/password form, error display, calls auth.login()
- [x] 1.3 Update `apps/dashboard/src/App.tsx` — wrap with AuthProvider + SocketProvider, route between LoginPage and DashboardLayout
- [x] 1.4 Add API_BASE_URL to config (localhost:3000 for dev, same-origin for prod)
- [x] 1.5 Create `RequireAuth` and `RequireRole` wrapper components for route protection

## 2. Dashboard Shell

- [x] 2.1 Create `apps/dashboard/src/components/layout/DashboardLayout.tsx` — TopBar + Sidebar + `<Outlet />`, accessible only when authenticated
- [x] 2.2 Create `apps/dashboard/src/components/layout/TopBar.tsx` — brand, kiosk count, active calls count, user badge, logout button
- [x] 2.3 Create `apps/dashboard/src/components/layout/Sidebar.tsx` — nav links filtered by user.role, active state highlight
- [x] 2.4 Apply global CSS: light theme from legacy operator.html (Syne + IBM Plex Mono fonts, colors)
- [x] 2.5 Verify layout renders after login

## 3. Socket.io Operator Context

- [x] 3.1 Create `apps/dashboard/src/contexts/SocketContext.tsx` — SocketProvider connecting to signaling server
- [x] 3.2 Emit `operator:register` on connect with operatorId and name from auth user
- [x] 3.3 Listen for `operator:registered` (receive kiosk list)
- [x] 3.4 Listen for `kiosks:update` (kiosk status changes)
- [x] 3.5 Listen for `connect`, `disconnect`, `error` events

## 4. WebRTC Receiver Hook

- [x] 4.1 Create `apps/dashboard/src/hooks/useWebRTC.ts` — receiver mode: getLocalStream, createPeerConnection, handleOffer, createAndSendAnswer, handleIceCandidate, cleanup
- [x] 4.2 `getLocalStream()` — getUserMedia for operator camera/mic
- [x] 4.3 `handleOffer(offer)` — create PC, set remote, create answer, set local, emit `webrtc:answer`
- [x] 4.4 `cleanupPeer()` — close PC, stop tracks, null video elements
- [x] 4.5 `toggleMute()` — enable/disable local audio tracks

## 5. Operator Panel — Call Management

- [x] 5.1 Create `apps/dashboard/src/components/operator/OperatorPanel.tsx` — main operator view with sidebar + content tabs layout
- [x] 5.2 Create `apps/dashboard/src/hooks/useOperatorState.ts` — pending calls Map, active call, kiosks list, event log array
- [x] 5.3 Handle `call:incoming` → add to pending calls, render in CallQueue
- [x] 5.4 Handle accept call → emit `call:accept`, move call to active, switch video panel
- [x] 5.5 Handle `call:taken` → remove from pending (other operator took it)

## 6. Operator Panel — UI Components

- [x] 6.1 Create `apps/dashboard/src/components/operator/CallQueue.tsx` — list of pending calls with building name, time ago, visitor preview, "Contestar" button
- [x] 6.2 Create `apps/dashboard/src/components/operator/VideoPanel.tsx` — remote video fullscreen, local video PiP, controls (open door, mute, hang up), call timer, building name display
- [x] 6.3 Create `apps/dashboard/src/components/operator/KioskList.tsx` — list with status dots (green/amber/blue) and status tags
- [x] 6.4 Create `apps/dashboard/src/components/operator/EventLog.tsx` — scrollable log with timestamp, type badge (CALL/DOOR/SYS/END), message
- [x] 6.5 Create incoming call toast notification (slides in from right, auto-dismiss 30s)
- [x] 6.6 Door control: emit `door:open`, log to events
- [x] 6.7 End call: emit `call:end`, cleanup WebRTC, reset video panel

## 7. Admin Panel

- [x] 7.1 Create `apps/dashboard/src/components/admin/AdminPanel.tsx` — admin dashboard with users table + create user form
- [x] 7.2 Create `apps/dashboard/src/components/admin/UsersTable.tsx` — paginated table with columns: Email, Name, Role (colored badge), Active (toggle switch), Actions (edit)
- [x] 7.3 Implement create user form — email, name, password, role dropdown, submit to POST /api/users
- [x] 7.4 Implement toggle active — PATCH /api/users/:id { active: true/false }
- [x] 7.5 Implement role change — dropdown inline in table, PATCH on change
- [x] 7.6 Handle API errors: duplicate email (409), network failure

## 8. Guard Panel Placeholder

- [x] 8.1 Create `apps/dashboard/src/components/guard/GuardPanel.tsx` — placeholder with "Rondas de Guardia — Próximamente en Fase 4"

## 9. Build & Verification

- [x] 9.1 Run `tsc --noEmit` — verify no TypeScript errors
- [x] 9.2 Run `pnpm --filter @porteria/dashboard build` — verify production build succeeds
- [x] 9.3 Start servers: `node legacy/server.js`, `pnpm --filter @porteria/api dev`, `pnpm --filter @porteria/dashboard dev`
- [x] 9.4 Verify login with admin@porteria.local / porteria123 → redirects to dashboard
- [x] 9.5 Verify sidebar shows correct items for admin vs operator roles
- [x] 9.6 Verify operator login connects to signaling and shows kiosks
- [x] 9.7 Verify admin panel loads user list from API
