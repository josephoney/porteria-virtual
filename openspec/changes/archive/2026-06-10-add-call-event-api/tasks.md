## 1. Schemas and DTOs

- [x] 1.1 Add Zod schemas for calls query params to `server/api/src/schemas/index.ts` — `callsQuerySchema` (page, pageSize, status?, from?, to?)
- [x] 1.2 Add Zod schemas for events query params — `eventsQuerySchema` (page, pageSize, eventType?, from?, to?)
- [x] 1.3 Add Zod schemas for kiosks query params — `kiosksQuerySchema` (status?)
- [x] 1.4 Export all new schemas from `schemas/index.ts`

## 2. Calls Service

- [x] 2.1 Create `server/api/src/services/calls.service.ts` — listCalls(orgId, filters) with leftJoin on kiosks, users, accessPoints
- [x] 2.2 Implement pagination: offset = (page-1) * pageSize, limit = pageSize (capped 100), count total separately
- [x] 2.3 Implement filters: status (eq), from/to date range (gte/lte on startedAt)
- [x] 2.4 Implement getCallById(id, orgId) — single call with same joins, org-scoped
- [x] 2.5 Implement getCallsTodayCount(orgId) — count calls started today for dashboard stats

## 3. Calls Routes

- [x] 3.1 Create `server/api/src/routes/calls.routes.ts` — register with Fastify plugin, JWT auth on all routes
- [x] 3.2 Implement `GET /calls` — admin+operator, parse query with callsQuerySchema, call listCalls
- [x] 3.3 Implement `GET /calls/:id` — admin+operator, call getCallById, 404 if not found

## 4. Events Service

- [x] 4.1 Create `server/api/src/services/events.service.ts` — listEvents(orgId, filters) with leftJoin on users for actorName
- [x] 4.2 Implement pagination: same pattern as calls (offset, limit, total count)
- [x] 4.3 Implement filters: eventType (eq), from/to date range (gte/lte on createdAt)
- [x] 4.4 Implement getEventStats(orgId) — group by eventType for today, with total count

## 5. Events Routes

- [x] 5.1 Create `server/api/src/routes/events.routes.ts` — register with Fastify plugin, JWT auth
- [x] 5.2 Implement `GET /events` — admin+operator, parse query with eventsQuerySchema, call listEvents
- [x] 5.3 Implement `GET /events/stats` — admin+operator, call getEventStats

## 6. Kiosks Service

- [x] 6.1 Create `server/api/src/services/kiosks.service.ts` — listKiosks(orgId, status?) with leftJoin on accessPoints and locations (via accessPoints)
- [x] 6.2 Implement status filter (eq on kiosks.status)
- [x] 6.3 Implement getKiosksCount(orgId) — total count for dashboard stats

## 7. Kiosks Routes

- [x] 7.1 Create `server/api/src/routes/kiosks.routes.ts` — register with Fastify plugin, JWT auth
- [x] 7.2 Implement `GET /kiosks` — admin+operator, parse query with kiosksQuerySchema, call listKiosks

## 8. Dashboard Stats Endpoint

- [x] 8.1 Create `GET /api/dashboard/stats` — combine callsToday, eventsToday, totalKiosks, activeCalls into single response
- [x] 8.2 Add to kiosks routes or a dedicated stats route file — use existing services (callsService.getCallsToday + eventsService.getEventStats + kiosksService.getKiosksCount)

## 9. Register Routes in Index

- [x] 9.1 Update `server/api/src/index.ts` — import and register callsRoutes at prefix `/api/calls`
- [x] 9.2 Register eventsRoutes at prefix `/api/events`
- [x] 9.3 Register kiosksRoutes at prefix `/api/kiosks`
- [x] 9.4 Register dashboard stats route at prefix `/api/dashboard`

## 10. Build and Verify

- [x] 10.1 Run `tsc --noEmit` in server/api — verify no TypeScript errors
- [x] 10.2 Run `pnpm --filter @porteria/api build` — verify production build succeeds
- [ ] 10.3 Start API server + PostgreSQL: verify `/api/calls` returns seed data (or empty array if no calls yet)
- [ ] 10.4 Verify `/api/events` returns paginated events
- [ ] 10.5 Verify `/api/kiosks` returns kiosk list with accessPointName
- [ ] 10.6 Verify `/api/dashboard/stats` returns aggregated counts
- [ ] 10.7 Verify RBAC: operator can access calls/events/kiosks but not admin users
- [ ] 10.8 Verify pagination: test page=1&pageSize=5 with multiple records
