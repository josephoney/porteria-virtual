## ADDED Requirements

### Requirement: The keyboard never hides the primary action

Every screen with a text field SHALL keep its primary action reachable while the
keyboard is open. The first tap on that action SHALL trigger it, not merely
dismiss the keyboard.

#### Scenario: A saved account is chosen in the login

- **WHEN** a password manager fills the credentials and the keyboard opens
- **THEN** the sign-in button stays visible above the keyboard
- **AND** the first tap signs in

#### Scenario: The password is typed

- **WHEN** the person types the password
- **THEN** the sign-in button remains reachable without dismissing the keyboard

### Requirement: Manual document entry stays readable

When a guard types a document by hand, the screen SHALL scroll so the field and
the verification action remain above the keyboard.

#### Scenario: The numeric keyboard opens

- **WHEN** the guard focuses the document field
- **THEN** the field and the verification action are visible above the keyboard
- **AND** the entered digits are readable while typing

### Requirement: The camera preview is centered

The scanning surface SHALL be centered in the available space, so the frame the
person aims with sits in the middle of the screen.

#### Scenario: The scanner opens

- **WHEN** the scan screen is shown
- **THEN** the preview occupies the central area
- **AND** the aiming frame is centered

### Requirement: The home states the community and the unit

The home of a guard or a resident SHALL state the community the session belongs
to and the unit it is associated with.

#### Scenario: A guard opens the app

- **WHEN** the guard signs in
- **THEN** the home shows the community name
- **AND** the unit or access point of the membership

#### Scenario: A resident opens the app

- **WHEN** the resident signs in
- **THEN** the home shows the community name
- **AND** the unit the resident owns or occupies
