# Guard board tabs

## ADDED Requirements

### Requirement: Board tabs

The guard board SHALL show the access movements and the shift history in separate tabs of the same container, so that opening one does not stack the other.

#### Scenario: Default tab

- WHEN a guard or an org admin opens the guard board
- THEN the active tab is "Ingresos y salidas"
- AND the shift history is not rendered until its tab is selected

#### Scenario: Switching tabs

- WHEN the user selects the "Turnos" tab
- THEN the access movement table is unmounted
- AND the page height does not grow from having both tables

#### Scenario: Each tab keeps its own paging

- WHEN the user moves to page 2 of one table and switches tabs
- THEN the other table shows the page it was left on
- AND switching back restores the first table's page

#### Scenario: Accessible tab semantics

- WHEN a screen reader focuses the tab list
- THEN each tab exposes its role and the selected state
- AND the panel is associated with the tab that controls it

### Requirement: Access events without the shift noise

The "Ingresos y salidas" tab SHALL hide the shift start and end entries by default, because those events already have their own tab, and SHALL keep every other movement visible.

#### Scenario: Default filter hides the shift events

- WHEN the user opens the "Ingresos y salidas" tab
- THEN the type filter reads "Sin turnos"
- AND `shift_start` and `shift_end` entries are not listed
- AND the request carries `excludeTypes=shift_start,shift_end`

#### Scenario: Manual notes stay visible

- WHEN a guard adds a manual entry during a shift
- THEN the entry is listed in the "Ingresos y salidas" tab
- AND the user does not have to change the filter to see it

#### Scenario: The filter can be widened

- WHEN the user selects "Todos"
- THEN the shift events are listed again
- AND selecting a single type lists only that type

#### Scenario: Clearing restores the default

- WHEN the user presses "Limpiar"
- THEN the type filter returns to "Sin turnos"

### Requirement: Page size selector

Both tables SHALL let the user choose how many rows to see, with the options 10, 35 and 50.

#### Scenario: Change the page size

- WHEN the user picks a different size in a table
- THEN that table reloads with the new size
- AND the page resets to the first one

#### Scenario: Default size

- WHEN a table is shown for the first time
- THEN it shows 10 rows
- AND the selector displays the current size

#### Scenario: Total is still visible

- WHEN the user changes the size
- THEN the indicator keeps showing the total number of records
- AND it shows the current page over the total pages

### Requirement: Page navigation

Both tables SHALL offer previous and next controls that move one page at a time.

#### Scenario: Next page

- WHEN the user activates next and there are more records
- THEN the table loads the following page
- AND the indicator updates

#### Scenario: Boundaries

- WHEN the user is on the first page
- THEN previous is disabled
- AND when the user is on the last page, next is disabled

#### Scenario: Records shrink below the current page

- WHEN a reload returns fewer pages than the one being shown
- THEN the table falls back to the last available page
- AND it never shows an empty page with records behind it

### Requirement: Bounded table height

A table SHALL never grow past the available page height; extra rows are reached by paging or by scrolling inside the table.

#### Scenario: Many rows on a small screen

- WHEN a page size larger than the viewport allows is selected
- THEN the table scrolls inside its container
- AND the page itself does not grow a scrollbar beyond its own height

#### Scenario: The header stays in place

- WHEN the user scrolls inside the table
- THEN the column headers remain visible
