# reports Specification

## Purpose

Define what the reports surface measures: the access activity the gate actually
records and the guard coverage that protects it, instead of the calls module the
product no longer operates. Every figure is scoped to what the requester can see,
can be read as a daily, weekly or monthly series, and can be exported in the same
shape it is shown.

## Requirements

### Requirement: The access report describes access activity

The reports surface SHALL report on the access activity recorded in the gate log
(`bitacora_entries`), not on the calls module. It SHALL present, for the selected
period and scope:

- total accesses by result (authorized, denied, code failure, observation),
- entries and exits as separate counts,
- accesses by method (QR or document),
- accesses by access point,
- accesses by hour of day,
- denial reasons ordered by frequency,
- the confirmation latency of QR accesses,
- the same data as a daily, weekly or monthly series.

#### Scenario: Totals match the recorded accesses
- **WHEN** a report is requested for a period
- **THEN** the total equals the number of access records in that period and scope
- **AND** the four results add up to the total
- **AND** entries and exits are counted separately and never summed

#### Scenario: Denials show why they happened
- **WHEN** the period contains denied accesses
- **THEN** the report lists the reasons ordered by frequency
- **AND** a code failure is not counted as a denial

#### Scenario: Confirmation latency states its coverage
- **WHEN** the period contains accesses with a confirmed scan
- **THEN** the average latency is computed from the scan time to the confirmation
  time
- **AND** accesses without a confirmed scan are excluded instead of counted as
  zero
- **AND** the response states how many accesses the average covers, so it is not
  read as applying to every access

### Requirement: The access method comes from the access record

The method SHALL be derived from the access record itself: an access verified by
document is recorded as a manual identity entry and reported as document, and
every other access is reported as QR. A pass scan is always a QR scan, so the
scan row does not drive the method metric.

#### Scenario: A QR entry is reported as QR
- **WHEN** a guard authorizes an access by scanning a pass
- **THEN** the access record reports the QR method

#### Scenario: A document entry is reported as document
- **WHEN** a guard authorizes an access by verifying a visitor document
- **THEN** the access record reports the document method
- **AND** the access is counted in the report even though it has no pass scan

#### Scenario: Existing records keep a defined method
- **WHEN** the report reads records created before the method was reported
- **THEN** every record still resolves to QR or document, never to an unknown
  method

### Requirement: The shift report describes guard coverage

The reports surface SHALL report on guard shifts for the selected period and
scope:

- open and closed shifts,
- hours worked per guard,
- accesses registered during each shift,
- shifts still open.

#### Scenario: Hours are computed from the shift
- **WHEN** a shift is closed
- **THEN** its duration is computed from its start to its end
- **AND** the total hours equal the sum of the hours per guard
- **AND** an open shift is not counted as zero hours; it is reported as open

#### Scenario: Shifts left open are visible
- **WHEN** a shift started in the period and was never closed
- **THEN** the report lists it as an open shift with its guard and start time

#### Scenario: Accesses are attributed to the shift
- **WHEN** an access is recorded during a shift
- **THEN** the shift report counts that access in that shift, whether it came
  from a QR pass or a document
- **AND** an access without a shift is not attributed to any guard's shift

### Requirement: Reports respect the requester scope

Report data SHALL be limited to what the requester can see: a community role sees
its community, an organization role sees its organization, and a platform
administrator sees every organization and can narrow by organization and
community.

#### Scenario: A community role cannot widen its scope
- **WHEN** a community-scoped role requests a report for another community
- **THEN** the response is narrowed to its own community
- **AND** no data from the other community is returned

#### Scenario: The platform administrator narrows by organization
- **WHEN** a platform administrator requests a report without an organization
- **THEN** the request is rejected as incomplete
- **AND** with an organization it returns that organization's data only

### Requirement: Every report can be exported

Each report SHALL be exportable to CSV, XLSX and PDF from the same filters and
scope as the report on screen. The exported file SHALL contain the same metrics
and the same rows the screen shows, plus the period and scope used.

#### Scenario: Exporting a report
- **WHEN** the user exports a report
- **THEN** the file downloads in the requested format
- **AND** it contains the metrics and rows of the current filters
- **AND** it states the period and the scope

#### Scenario: Exporting respects scope
- **WHEN** a community-scoped role exports a report
- **THEN** the file contains only its community's data

#### Scenario: An unsupported format is rejected
- **WHEN** an unknown format is requested
- **THEN** the request is rejected without producing a file

### Requirement: Calls are not part of the report surface

The reports surface SHALL NOT present call metrics. The calls module SHALL
remain available in the code without being surfaced in reports.

#### Scenario: Reports show no call metrics
- **WHEN** a user opens the reports surface
- **THEN** no call count, call duration or operator response metric is shown
