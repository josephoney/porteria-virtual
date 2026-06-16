## 1. Ringtone definitions module

- [x] 1.1 Create `apps/dashboard/src/lib/ringtones.ts` with `RingtoneVoice`, `RingtoneDefinition` interfaces
- [x] 1.2 Define 10 ringtones (`classic`, `digital`, `soft`, `oldphone`, `pulse`, `alarm`, `buzzer`, `knock`, `highbeep`, `deep`) with voices and pattern arrays
- [x] 1.3 Export `RINGTONE_DEFINITIONS` array, `getRingtoneDefinition(id)`, and `DEFAULT_RINGTONE_ID`

## 2. Ringtone player engine

- [x] 2.1 Implement `createRingPlayer(def)` returning `{ start, stop }` with setTimeout chain scheduling through pattern steps
- [x] 2.2 Handle multiple simultaneous voices per ON step (create separate OscillatorNode + GainNode per voice)
- [x] 2.3 Implement `previewRingtone(def)` playing pattern once with self-cleaning AudioContext
- [x] 2.4 Handle consecutive preview cancellation (clear previous timeout and context)
- [x] 2.5 Handle AudioContext creation failure silently (wrap in try/catch)

## 3. SocketContext integration

- [x] 3.1 Remove hardcoded oscillator code from `startRing()` and `stopRing()`
- [x] 3.2 Add `selectedRingtoneId` state initialized from `localStorage.getItem('ringtone')` with fallback to `DEFAULT_RINGTONE_ID`
- [x] 3.3 Refactor `startRing()` to use `createRingPlayer(getRingtoneDefinition(selectedRingtoneId))`
- [x] 3.4 Expose `setRingtone(id: string)` and `selectedRingtoneId` and `previewRingtone(id: string)` in context value
- [x] 3.5 `setRingtone` validates ID exists, saves to localStorage, updates state

## 4. RingtoneSelector component

- [x] 4.1 Create `apps/dashboard/src/components/operator/RingtoneSelector.tsx`
- [x] 4.2 Render `<select>` dropdown with all ringtones from `RINGTONE_DEFINITIONS`
- [x] 4.3 On change: call `setRingtone(id)` and `previewRingtone(id)` from SocketContext
- [x] 4.4 Show current selection from `selectedRingtoneId`

## 5. OperatorPanel integration

- [x] 5.1 Import and render `RingtoneSelector` in `OperatorPanel.tsx` panel-main-header, next to the display mode toggle
- [x] 5.2 Conditionally render selector only for operator and admin roles (not guard)

## 6. Styling

- [x] 6.1 Add CSS for `.ringtone-select` dropdown in `App.css` matching existing design tokens
- [x] 6.2 Style `.panel-main-controls` flex container to group ringtone selector and display mode toggle

## 7. Verification

- [x] 7.1 Verify ringtone persists across page reloads (localStorage check)
- [x] 7.2 Verify all 10 ringtones are audible and distinct when previewed
- [x] 7.3 Verify ring plays on incoming call and stops on accept/cancel/timeout/taken
- [x] 7.4 Verify changing ringtone during active ring does not affect current ring playback
- [x] 7.5 Verify selector is hidden for guard role
