# Tasks: pass-ticket-status

## 1. Helper compartido

- [x] 1.1 Agregar `PassTicketTone` (`success`, `warning`, `danger`, `neutral`) y `PassTicketState` con `kind`, `tone`, `label`, `detail` e `icon`.
- [x] 1.2 Implementar `passTicketState(pass, now)` con precedencia revoked → expired → used → inside → sin usos hoy (`exhausted`) → re-entry → pending. Usar `rule.remainingUses` y caer a `maxUses - exitCount` en `once`.
- [x] 1.3 Exportar los tipos y la función desde `packages/shared/src/index.ts`.
- [x] 1.4 Cubrir con unit tests pendiente, adentro, re-entrada, sin usos hoy, usado, vencido, revocado y `entry_only`.

## 2. Ticket móvil

- [x] 2.1 Mostrar el estado con color, ícono y texto arriba del QR en `apps/zima-qr-access/app/pass/[id].tsx`.
- [x] 2.2 Mostrar el contador de re-entrada y el detalle de «esperando salida».
- [x] 2.3 Refrescar el pase al recuperar foco y junto con la rotación del QR.
- [x] 2.4 Verificar que la rotación del QR no reinicie el estado: el estado sale del pase, no del token.

## 3. Web pública

- [x] 3.1 Usar el helper en `QrView`; `PreviewCard` queda fuera porque no muestra el QR.
- [x] 3.2 Extender `PublicPassPreview` y `PassStatusResponse` con `type`, `recurrence`, `maxUses`, `exitCount` y `remainingUses`; `presenceState` ya estaba.
- [x] 3.3 Refrescar el estado con el poll de 5 s y el QR cada 20 s.

## 4. Accesibilidad y copy

- [x] 4.1 Etiquetas en español, sin `once/range/weekly`, con color + ícono + texto.
- [x] 4.2 Usar contraste suficiente y no depender sólo del color.

## 5. Verificación

- [x] 5.1 `pnpm --filter @porteria/shared build`.
- [x] 5.2 API y móvil: `tsc --noEmit` limpios. `pass-web`: `vite build` pasa; `tsc -b` queda bloqueado por el TS2786 preexistente de `QRCodeSVG` (React 18 vs `@types/react@19`).
- [x] 5.3 Prettier y `openspec validate pass-ticket-status --strict`.
- [x] 5.4 Smoke test manual: crear pases de cada modalidad, entrar y salir, y verificar los estados en móvil y web.
