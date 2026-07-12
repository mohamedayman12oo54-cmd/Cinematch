import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

export function renderApp(ui, { route = '/home', keepPrevious = false } = {}) {
  if (!keepPrevious) cleanup();
  const entry = typeof route === 'string' ? { pathname: route } : route;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

export const TEST_USER = {
  email: `tester_${Date.now()}@example.com`,
  password: 'password123',
};
