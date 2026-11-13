## ADDED Requirements

### Requirement: Community daily pass limit

Each community SHALL store whether the daily authorization limit is enabled and the maximum number of authorizations allowed per unit per day, defaulting to enabled with 50.

#### Scenario: New community starts with the default rule

- WHEN an administrator creates a community without touching the rules section
- THEN the limit is enabled
- AND the maximum is 50 authorizations per unit per day

#### Scenario: Existing communities keep working

- WHEN the migration runs on a database with communities that already exist
- THEN every community has the limit enabled with a maximum of 50
- AND no community loses access to authorizations

#### Scenario: Counting ignores the rest of the community

- WHEN a unit reaches the limit
- THEN authorizations for that unit are rejected
- AND authorizations for other units of the same community are unaffected

#### Scenario: The day is the community's day

- WHEN the limit is evaluated
- THEN the count starts at midnight in the community timezone
- AND it does not use the server timezone

### Requirement: Administration controls the rule

The community form SHALL expose the rule both when creating and when editing a community, under a rules section.

#### Scenario: Enable or disable the limit

- WHEN the administrator toggles the limit off
- THEN the community accepts unlimited authorizations per day
- AND the stored maximum is kept for when the limit is turned back on

#### Scenario: Set the maximum

- WHEN the administrator types a maximum and saves
- THEN the value is persisted for that community
- AND the number cannot be less than 1 nor more than 500

#### Scenario: Disabled limit does not hide the number

- WHEN the limit is disabled
- THEN the maximum input stays visible and is disabled
- AND the value shown is the one stored, not an empty field

#### Scenario: The rule is part of the community detail

- WHEN the administrator expands a community row
- THEN the detail shows whether the limit is enabled and its maximum

### Requirement: The limit applies to the individual authorization

The individual authorization endpoint SHALL read the rule of the requesting community before counting.

#### Scenario: Rejection states the maximum

- WHEN a resident reaches the daily limit
- THEN the request fails with `429` and `daily_limit_reached`
- AND the response includes `max` with the community maximum

#### Scenario: Disabled limit skips the count

- WHEN the community has the limit disabled
- THEN no counting query runs
- AND the authorization is created even if the unit already had many that day

#### Scenario: Bulk upload is exempt

- WHEN a resident uploads a batch
- THEN the daily limit of the community is not applied
- AND the batch keeps its own 200 visitor cap

#### Scenario: Global kill switch

- WHEN `PASS_DAILY_LIMIT_PER_UNIT` is set to `0`
- THEN the limit is disabled for every community
- AND this overrides the community rule
