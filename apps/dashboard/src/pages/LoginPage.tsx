import { AuthShell } from '../components/auth/AuthShell';
import { LoginForm } from '../components/login-form';

export function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
