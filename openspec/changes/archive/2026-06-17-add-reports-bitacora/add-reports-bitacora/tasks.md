## 1. Shared Types

- [x] 1.1 Create `packages/shared/src/types/reports.ts` with `DailyReport`, `WeeklyReport`, `MonthlyReport`, `CallStats`, `EventTimeSeries` interfaces
- [x] 1.2 Create `packages/shared/src/dto/reports.ts` with request/response DTOs for report endpoints
- [x] 1.3 Add new event type constants to `EventType` enum: `DoorOpen`, `UserLogin`, `UserLogout`, `UserCreated`, `UserUpdated`, `KioskOnline`, `KioskOffline`
- [x] 1.4 Export all new types and DTOs from `packages/shared/src/index.ts`

## 2. API Server: Internal events endpoint

- [x] 2.1 Add `POST /api/internal/events` route in `server/api/src/routes/events.routes.ts` with API key middleware
- [x] 2.2 Body validates: `eventType` (required string), `actorId?`, `actorRole?`, `organizationId` (required), `locationId?`, `accessPointId?`, `metadata?` (optional JSON)
- [x] 2.3 Route calls existing `insertEvent()` from `events.service.ts`

## 3. Event emission from signaling server

- [x] 3.1 In `handlers/operator.ts` `door:open` handler: fire-and-forget POST to `/api/internal/events` with `eventType: 'door.open'`, `actorId: operatorId`, `actorRole: 'operator'`, `accessPointId` resolved from kiosk
- [x] 3.2 In `handlers/kiosk.ts` `kiosk:register`: fire-and-forget POST `eventType: 'kiosk.online'` with kiosk info
- [x] 3.3 In `index.ts` disconnect handler: fire-and-forget POST `eventType: 'kiosk.offline'` for disconnected kiosks
- [x] 3.4 Add `organizationId` resolution helper to `persist.ts` (reuse JOIN chain pattern from calls.service.ts or add internal API lookup)

## 4. Event emission from API server

- [x] 4.1 In auth routes: emit `user.login` event on successful `POST /api/auth/login`
- [x] 4.2 In auth routes: emit `user.logout` event on `POST /api/auth/logout` (use refresh token lookup for userId)
- [x] 4.3 In users routes: emit `user.created` event after successful `POST /api/users`
- [x] 4.4 In users routes: emit `user.updated` event after successful `PATCH /api/users/:id` with changed fields in metadata

## 5. Modified endpoints: event-log-api filters

- [x] 5.1 Add `actorId` query param filter to `GET /api/events` in `events.service.ts` (`eq(events.actorId, actorId)`)
- [x] 5.2 Add `accessPointId` query param filter to `GET /api/events` in `events.service.ts`
- [x] 5.3 Extend `GET /api/events/stats` to accept optional `from`/`to` query params (defaults to today)

## 6. Modified endpoints: dashboard-stats date range

- [x] 6.1 Add optional `from`/`to` query params to `GET /api/dashboard/stats` schema
- [x] 6.2 Update `getCallsTodayCount()` and `getEventsTodayCount()` to support date range when provided
- [x] 6.3 Keep backward compatibility: no params = today (current behavior)

## 7. Reports API: service layer

- [x] 7.1 Create `server/api/src/services/reports.service.ts` with `getDailyReport(orgId, date)`, `getWeeklyReport(orgId, weekStart)`, `getMonthlyReport(orgId, month)`
- [x] 7.2 Implement `getDailyReport`: count calls total/answered/missed for the day, door opens, calls by hour using `time_bucket('1 hour', started_at)`
- [x] 7.3 Implement `getWeeklyReport`: per-day breakdown for 7 days (Monday to Sunday), with daily totals and overall totals
- [x] 7.4 Implement `getMonthlyReport`: per-week breakdown within the month using `time_bucket`, same metrics as weekly
- [x] 7.5 Implement `getCallStats(orgId, from, to)`: total calls, answered/missed counts, answerRate, avgDuration, callsByHour, callsByKiosk using JOINs + `time_bucket`
- [x] 7.6 Implement `getEventBreakdown(orgId, from, to, bucket)`: `time_bucket(bucket, created_at)` with COUNT grouped by event_type

## 8. Reports API: routes

- [x] 8.1 Create `server/api/src/routes/reports.routes.ts` with JWT auth hook and RBAC (`requireRole('admin', 'operator')`)
- [x] 8.2 Add `GET /reports/daily` with optional `?date=` query param
- [x] 8.3 Add `GET /reports/weekly` with optional `?week=` query param
- [x] 8.4 Add `GET /reports/monthly` with optional `?month=` query param
- [x] 8.5 Add `GET /reports/call-stats` with optional `?from=&to=` (default last 7 days)
- [x] 8.6 Add `GET /reports/event-breakdown` with required `?from=&to=` and optional `?bucket=day|hour`
- [x] 8.7 Register routes in `server/api/src/index.ts` under prefix `/api/reports`

## 9. Reports UI: bitácora view

- [x] 9.1 Create `apps/dashboard/src/components/admin/BitacoraView.tsx` with paginated event table
- [x] 9.2 Add event type filter dropdown (all event types from EventType enum)
- [x] 9.3 Add date range inputs (Desde / Hasta) with default to last 7 days
- [x] 9.4 Add actor and access point filter dropdowns (fetch actor list from users, access points from kiosks/relays)
- [x] 9.5 Implement expandable row showing metadata JSON on click
- [x] 9.6 Add event type badges with colors consistent with existing design system
- [x] 9.7 Integrate `BitacoraView` as a tab/section in `AdminPanel.tsx`

## 10. Reports UI: reports panel

- [x] 10.1 Create `apps/dashboard/src/components/admin/ReportsPanel.tsx` with period selector (Diario/Semanal/Mensual tabs)
- [x] 10.2 Implement date picker for daily, week picker for weekly, month picker for monthly
- [x] 10.3 Create `ReportChart.tsx` wrapper using Recharts (install `recharts` as dashboard dependency)
- [x] 10.4 Implement daily view: summary cards (total/answered/missed/doors) + bar chart (calls by hour)
- [x] 10.5 Implement weekly view: line chart (daily trend) + summary table with per-day breakdown
- [x] 10.6 Implement monthly view: bar chart (weekly aggregates) + summary table
- [x] 10.7 Add call stats section: answer rate, avg duration, calls by kiosk table
- [x] 10.8 Integrate `ReportsPanel` as a tab/section in `AdminPanel.tsx`
- [x] 10.9 Apply design system tokens (colors `#f5f4ef` / `#1a1916`, fonts Syne + IBM Plex Mono) to all report components

## 11. Operator panel: bitácora link

- [x] 11.1 Add "Ver bitácora completa" link in `OperatorPanel.tsx` EventLog section
- [x] 11.2 Link navigates to the admin bitácora view (if operator has access) or shows info tooltip

## 12. Verification

- [ ] 12.1 Trigger door open from dashboard → verify `door.open` event appears in `GET /api/events`
- [ ] 12.2 Login/logout → verify `user.login` and `user.logout` events appear
- [ ] 12.3 Create/update user → verify `user.created` and `user.updated` events appear
- [ ] 12.4 Request `GET /api/reports/daily` → verify aggregated counts are correct
- [ ] 12.5 Request `GET /api/reports/weekly` → verify daily breakdown within week
- [ ] 12.6 Request `GET /api/reports/monthly` → verify weekly breakdown within month
- [ ] 12.7 Request `GET /api/reports/call-stats` → verify metrics (answerRate, avgDuration, callsByKiosk)
- [ ] 12.8 Request `GET /api/reports/event-breakdown` → verify time_bucket results with correct groupings
- [ ] 12.9 Bitácora view: verify filters work, pagination works, detail expansion works
- [ ] 12.10 Reports panel: verify charts render correctly, period selectors work, data matches API responses
