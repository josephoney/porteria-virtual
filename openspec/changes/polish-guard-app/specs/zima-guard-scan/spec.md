## ADDED Requirements

### Requirement: Explicit start shift action

The guard mode SHALL start the shift with a single explicit primary action.

El punto de acceso se elige primero y el turno arranca después, con un botón propio. Antes
toda la tarjeta del punto de acceso era el botón, lo que no daba una acción de arranque
reconocible ni un color que la distinguiera.

#### Scenario: Select the access point

- **WHEN** the guard has no open shift and the community has active access points
- **THEN** the app lists them as selectable options
- **AND** only one option is selected at a time
- **AND** the access point of the membership (`defaultAccessPointId`) starts selected, or
  the first one when the membership has none

#### Scenario: Start the shift

- **WHEN** the guard taps the start action with an access point selected
- **THEN** the app calls `POST /api/guard/shifts/start` with that access point
- **AND** the start action is rendered in the success green of the theme
- **AND** the label reads "Iniciar turno"
- **AND** the action is disabled while the request is in flight

#### Scenario: No access point selected

- **WHEN** no access point is selected
- **THEN** the start action is disabled
- **AND** no request is sent

#### Scenario: No active access points

- **WHEN** the community has no active access points
- **THEN** the app shows the empty state and explains that the administrator must configure
  the access points
- **AND** the start action is not rendered

#### Scenario: Start fails

- **WHEN** the start request fails
- **THEN** the app shows the error and keeps the selected access point
- **AND** the guard stays on the start state, without an open shift

### Requirement: Camera on demand

The scanner SHALL keep the camera off until the guard asks for it.

#### Scenario: Entering the shift does not open the camera

- **WHEN** the guard has an open shift
- **THEN** the scan section shows the "Escanear QR" action and no camera preview
- **AND** the camera is not mounted, so the device does not hold it

#### Scenario: Open the camera

- **WHEN** the guard taps "Escanear QR"
- **THEN** the app requests camera permission if it was not granted yet
- **AND**, once granted, mounts the camera preview in the scan section

#### Scenario: Cancel the camera

- **WHEN** the camera preview is open
- **THEN** a "Cancelar" action is available next to it
- **AND** tapping it unmounts the camera and returns to the closed state
- **AND** the section is ready to open the camera again

#### Scenario: Permission denied

- **WHEN** the guard denies camera permission
- **THEN** the app explains that the camera is needed and does not mount it
- **AND** the manual token entry stays available

#### Scenario: Camera closes after a scan

- **WHEN** a scan returns an authorization, a denial, or an error
- **THEN** the camera is unmounted
- **AND** it does not reopen on its own

### Requirement: Manual token without the camera

The guard SHALL be able to scan by typing the token without opening the camera.

#### Scenario: Manual scan

- **WHEN** the guard types a token and taps "Escanear token"
- **THEN** the app sends the token to `/api/access/scan`
- **AND** the camera stays off

#### Scenario: Empty token

- **WHEN** the token field is empty or only whitespace
- **THEN** the manual scan action is disabled
- **AND** no request is sent

### Requirement: Collapsible guard sections

The guard screen SHALL collapse and expand its lists from the section header.

Aplica a "Mis turnos" y a la actividad del turno abierto. El encabezado es el control, y
no hay un botón aparte.

#### Scenario: Toggle from the header

- **WHEN** the guard taps the header of a collapsible section
- **THEN** the section expands if it was collapsed and collapses if it was expanded
- **AND** the rows inside are mounted only while the section is expanded

#### Scenario: State is announced

- **WHEN** a collapsible section renders
- **THEN** its header exposes the expanded or collapsed state to accessibility services
- **AND** the header identifies the section by name

#### Scenario: Shifts list starts collapsed

- **WHEN** the guard screen loads with an open shift
- **THEN** "Mis turnos" starts collapsed
- **AND** its header shows how many shifts are listed

#### Scenario: Activity starts expanded

- **WHEN** the guard enters a shift that already has movements
- **THEN** the activity section starts expanded so the last movement is visible
- **AND** the guard can collapse it with a tap

#### Scenario: State does not persist across visits

- **WHEN** the guard leaves the screen and comes back
- **THEN** each section returns to its default state
- **AND** no collapse preference is stored on the device

### Requirement: Shift activity log

The guard SHALL see the movements registered during the open shift, and only those.

El registro es de la base. La app no lo guarda localmente: al cerrar el turno la sección
desaparece y el historial completo queda disponible en el dashboard.

#### Scenario: List the movements of the shift

- **WHEN** the guard has an open shift
- **THEN** the app lists the bitácora entries with that `shiftId`
- **AND** each row shows the time, the visitor, the movement (ingreso, egreso o rechazo)
  and the destination
- **AND** the newest movement appears first

#### Scenario: Empty activity

- **WHEN** the open shift has no movements yet
- **THEN** the app shows an empty state inside the section
- **AND** the scan section stays available

#### Scenario: Closing the shift hides the activity

- **WHEN** the guard ends the shift
- **THEN** the activity section is no longer rendered
- **AND** the app returns to the start-shift state
- **AND** the entries are not deleted: they remain in the bitácora for the dashboard

#### Scenario: Refresh after a decision

- **WHEN** the guard confirms or rejects a scan
- **THEN** the activity list reloads and shows the new movement without navigating
- **AND** a denied scan appears with its rejection reason

#### Scenario: Activity survives an app restart

- **WHEN** the guard closes and reopens the app while the shift is still open
- **THEN** the activity list is rebuilt from the server
- **AND** it shows the same movements

#### Scenario: Activity fails to load

- **WHEN** the bitácora request fails
- **THEN** the section shows the error and a retry action
- **AND** the scanner keeps working
