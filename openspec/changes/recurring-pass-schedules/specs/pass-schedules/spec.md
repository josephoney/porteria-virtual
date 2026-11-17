# Spec delta: recurring pass schedules

## ADDED Requirements

### Requirement: A pass declares when it can be used

Every pass SHALL declare a validity period, a repetition mode and the days and hours in which it is valid.

#### Scenario: One-time pass

- WHEN the resident creates a pass that does not repeat
- THEN it is valid only inside its validity period
- AND it does not restrict days or hours

#### Scenario: Consecutive days

- WHEN the resident chooses a date range
- THEN the pass is valid every day between those dates
- AND it uses the same time window each day

#### Scenario: Specific weekdays

- WHEN the resident marks Monday, Wednesday and Friday until a date
- THEN the pass is valid only on those weekdays until that date
- AND it uses the same time window each day

#### Scenario: A weekly schedule requires days

- WHEN the resident selects the weekly mode without marking a day
- THEN the form does not allow confirming
- AND the API rejects a weekly pass without days

### Requirement: One time window per day

The pass SHALL allow a single daily time window.

#### Scenario: Inside the window

- WHEN the visitor arrives inside the allowed window on an allowed day
- THEN the pass allows the entry

#### Scenario: Outside the window

- WHEN the visitor arrives outside the allowed window
- THEN the pass is refused with the reason "out of schedule"

#### Scenario: Lunch is covered by uses

- WHEN the resident needs the visitor to leave and come back at noon
- THEN they raise the daily uses instead of declaring a second window

### Requirement: Daily uses

The pass SHALL limit how many entry and exit pairs are allowed per day, and SHALL reset that count each day.

#### Scenario: Uses reset the next day

- WHEN a pass with one daily use was consumed yesterday
- THEN the next allowed day starts with the full count again

#### Scenario: Uses exhausted today

- WHEN the visitor already used all the uses of the day
- THEN another entry is refused with the reason "daily uses exhausted"

#### Scenario: Entering does not consume

- WHEN the visitor enters
- THEN the use is consumed on the exit, as with any pair

### Requirement: Entry and exit by default

A pass SHALL allow entry and exit unless the resident explicitly asks for entry only.

#### Scenario: Default behaviour

- WHEN the resident creates a pass without touching the option
- THEN the visitor can enter and leave

#### Scenario: Entry only

- WHEN the resident marks the entry-only option
- THEN the pass is consumed on the first entry
- AND it does not wait for an exit

### Requirement: The guard sees the reason, not the rule

When a pass is refused, the system SHALL answer with the specific reason and when the visitor could try again.

#### Scenario: Wrong day

- WHEN the visitor arrives on a weekday that is not allowed
- THEN the guard reads that today is not an authorized day

#### Scenario: Outside the window

- WHEN the visitor arrives before or after the allowed hours
- THEN the guard reads the allowed window

#### Scenario: Expired

- WHEN the validity period ended
- THEN the guard reads until when the authorization was valid

### Requirement: Existing passes keep working

The change SHALL NOT alter the behaviour of passes created before it.

#### Scenario: A pass created before the change

- WHEN an old pass is used
- THEN it behaves as a one-time pass with no day or hour restriction

### Requirement: The resident picks the duration, not the dates

The form SHALL offer three exclusive duration options and SHALL only ask for dates when the range is chosen.

#### Scenario: Authorizing someone for today

- WHEN the resident presses "Hoy"
- THEN the pass is valid today
- AND no second date field is shown
- AND the entry time is taken from the moment of creation unless the resident unchecks immediate entry

#### Scenario: Authorizing someone for tomorrow

- WHEN the resident presses "Mañana"
- THEN the pass is valid tomorrow
- AND no second date field is shown

#### Scenario: Authorizing several days

- WHEN the resident presses "Rango de días"
- THEN both date fields are shown
- AND the pass is valid between them

#### Scenario: The three options exclude each other

- WHEN the resident picks one duration
- THEN the other two stop being selected

### Requirement: Immediate entry or a chosen hour

With the today option, the resident SHALL choose between entering immediately and entering from a chosen hour.

#### Scenario: Immediate entry by default

- WHEN the resident picks "Hoy"
- THEN the immediate entry option is checked
- AND the entry hour selector is disabled
- AND the pass is valid from the moment it is created, with second precision

#### Scenario: A later start today

- WHEN the resident unchecks immediate entry
- THEN the entry hour selector becomes available
- AND the pass does not allow entry before that hour

#### Scenario: Tomorrow and ranges always pick an hour

- WHEN the resident picks "Mañana" or a date range
- THEN the entry hour selector is always available

### Requirement: Times are chosen in fifteen minute steps

The time selectors SHALL only offer quarter hours.

#### Scenario: Picking the window

- WHEN the resident opens a time selector
- THEN the minutes available are 00, 15, 30 and 45
- AND any other minute value cannot be selected
