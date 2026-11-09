# Report location references

The report endpoints (`daily`, `weekly`, `monthly`, `call-stats`, and
`event-breakdown`) read from `calls` and `events`. Neither table stores a
`unit_id` or a `location_unit_id`; their scope is the organization and,
optionally, the community.

The membership migration moved resident references to
`memberships.location_unit_id`. No report DTO exposes the legacy `unitId`, so
there is no stale unit reference to rewrite in the report layer.

Verification performed:

- `reports.service.ts` only filters by `organization_id`, `community_id`, and
  date ranges.
- `packages/shared/src/types/reports.ts` has no `unitId` or `locationUnitId`
  fields.
- Integration tests cover daily, weekly, monthly, call-stats, and
  event-breakdown responses.
- Unit-level resident data is available through the unit resident endpoints,
  which use `location_residents.location_unit_id`.

If a future report needs unit-level grouping, it should be built from
`location_residents` or from event metadata, not by reintroducing a legacy
`unit_id` column.
