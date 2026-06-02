import { Routes, Route } from 'react-router-dom';
import { UserRole, UserRoleValues } from '@porteria/shared';

function Home() {
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>Portería Virtual — Dashboard</h1>
      <p>Panel de operador, admin y guardia</p>
      <p>Roles: {UserRoleValues.join(', ')}</p>
      <p>Operador: {UserRole.Operator}</p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

export default App;
