## ADDED Requirements

### Requirement: Report DTOs
The shared package SHALL define Data Transfer Objects for report requests and responses.

#### Scenario: Daily report response type
- **WHEN** a developer inspects the `DailyReport` type
- **THEN** it includes `date: string`, `totalCalls: number`, `answeredCalls: number`, `missedCalls: number`, `callsByHour: { hour: number; count: number }[]`, `totalDoorOpens: number`, `eventsByType: { eventType: string; count: number }[]`

#### Scenario: Weekly report response type
- **WHEN** a developer inspects the `WeeklyReport` type
- **THEN** it includes `weekStart: string`, `days: { date: string; totalCalls: number; answeredCalls: number; missedCalls: number; doorOpens: number }[]`, `totals: { calls: number; answered: number; missed: number; doors: number }`

#### Scenario: Monthly report response type
- **WHEN** a developer inspects the `MonthlyReport` type
- **THEN** it includes `month: string`, `weeks: { weekStart: string; totalCalls: number; answeredCalls: number; missedCalls: number; doorOpens: number }[]`, `totals: { calls: number; answered: number; missed: number; doors: number }`

#### Scenario: Call stats response type
- **WHEN** a developer inspects the `CallStats` type
- **THEN** it includes `totalCalls: number`, `answeredCount: number`, `missedCount: number`, `answerRate: number`, `avgDuration: number`, `callsByHour: { hour: number; count: number }[]`, `callsByKiosk: { kioskId: string; kioskName: string; count: number }[]`

#### Scenario: Event time series response type
- **WHEN** a developer inspects the `EventTimeSeries` type
- **THEN** it includes `buckets: { time: string; [eventType: string]: number }[]`

### Requirement: Event audit type additions
The shared package SHALL extend the EventType enum with new event types.

#### Scenario: New event type constants
- **WHEN** a developer uses `EventType.DoorOpen`
- **THEN** the value is the string `'door.open'`
- **THEN** all new types are available: `DoorOpen`, `UserLogin`, `UserLogout`, `UserCreated`, `UserUpdated`, `KioskOnline`, `KioskOffline`
