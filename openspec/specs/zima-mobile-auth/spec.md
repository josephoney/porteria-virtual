# zima-mobile-auth Specification

## Purpose
TBD - created by archiving change polish-guard-app. Update Purpose after archive.
## Requirements
### Requirement: Brand logo on auth screens

The authentication screens SHALL show the brand logo instead of the placeholder mark.

El logo es la marca de Zima Seguridad y reemplaza el cuadrado con la letra "Z" que
ocupaba el encabezado de la pantalla de acceso.

#### Scenario: Login shows the logo

- **WHEN** the login screen loads
- **THEN** it shows the Zima logo above the form
- **AND** the placeholder square with the letter "Z" is no longer rendered

#### Scenario: Logo keeps its proportions

- **WHEN** the logo renders on a narrow screen such as a 320 px wide device
- **THEN** its width fits the viewport without horizontal scroll
- **AND** the 2.8:1 ratio of the source artwork is preserved
- **AND** the logo is not stretched, cropped, or rotated

#### Scenario: Logo is legible on the dark theme

- **WHEN** the login screen renders on the app background `#0B1220`
- **THEN** the logo is drawn in white
- **AND** it keeps contrast with the background

#### Scenario: Logo has an accessible name

- **WHEN** a screen reader focuses the login screen
- **THEN** the logo is announced as "Zima Seguridad"
- **AND** the logo is not announced as a button or an interactive element

#### Scenario: Context selection keeps the brand

- **WHEN** a user with more than one membership reaches the context selection screen
- **THEN** that screen shows the same logo
- **AND** the selection itself is unchanged

