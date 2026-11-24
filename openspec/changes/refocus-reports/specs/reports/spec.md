## ADDED Requirements

### Requirement: The access report describes access activity

The reports surface SHALL report on access activity recorded by the gate, not on
the calls module. It SHALL present, for the selected period and scope:

- total accesses by result (authorized, denied, code failure),
- entries and exits as separate counts,
- accesses by method (QR or document),
- accesses by access point,
- accesses by hour of day,
- denial reasons ordered by frequency,
- the average time between a scan and its confirmation,
- the same data as a daily, weekly or monthly series.

#### Scenario: Totals match the recorded scans
- **WHEN** a report is requested for a period
- **THEN** the authorized count equals the number of scans authorized in that
  period and scope
- **AND** entries and exits are counted separately and never summed

#### Scenario: Denials show why they happened
- **WHEN** the period contains denied accesses
- **THEN** the report lists the reasons ordered by frequency
- **AND** a code failure is not counted as a denial

#### Scenario: Confirmation latency comes from the scan
- **WHEN** the period contains confirmed scans
- **THEN** the average latency is computed from the scan time to the
  confirmation time
- **AND** scans without a confirmation are excluded instead of counted as zero

### Requirement: The access method is recorded per scan

Every scan SHALL record whether the guard verified a QR pass or a document, so
the method can be reported without inferring it from other records.

#### Scenario: A QR entry records the QR method
- **WHEN** a guard authorizes an access by scanning a pass
- **THEN** the scan records the QR method

#### Scenario: A document entry records the document method
- **WHEN** a guard authorizes an access by verifying a visitor document
- **THEN** the scan records the document method

#### Scenario: Existing scans keep a defined method
- **WHEN** the method column is introduced
- **THEN** existing scans keep a value, defaulting to the QR method, and the
  document entries previously identified in the event payload are corrected

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
- **AND** an open shift is not counted as zero hours; it is reported as open

#### Scenario: Shifts left open are visible
- **WHEN** a shift started in the period and was never closed
- **THEN** the report lists it as an open shift with its guard and start time

#### Scenario: Accesses are attributed to the shift
- **WHEN** a scan is registered during a shift
- **THEN** the shift report counts that access in that shift
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
