## ADDED Requirements

### Requirement: Global call overlay in layout
The DashboardLayout SHALL render an IncomingCallOverlay component above the Outlet that handles incoming call notifications and active call PiP.

#### Scenario: Overlay renders in layout
- **WHEN** the dashboard layout mounts
- **THEN** the IncomingCallOverlay is rendered as a direct child of the layout, before the Outlet
- **THEN** the overlay is positioned with `position: fixed` and high `z-index` to float above all content

#### Scenario: Overlay persists on route change
- **WHEN** the operator navigates from `/` to `/admin` or `/guard`
- **THEN** the IncomingCallOverlay remains mounted and functional
- **THEN** any active toast, ringtone, or PiP overlay is unaffected by the route change
