import { MembershipRole, MembershipRoleValues } from '@porteria/shared';

function App() {
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>Portería Virtual — Resident</h1>
      <p>App móvil para residentes (PWA)</p>
      <p>Roles: {MembershipRoleValues.join(', ')}</p>
      <p>Residente: {MembershipRole.Resident}</p>
    </div>
  );
}

export default App;
