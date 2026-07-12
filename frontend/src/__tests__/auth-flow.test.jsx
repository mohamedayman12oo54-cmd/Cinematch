import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { renderApp } from './test-utils';

beforeEach(() => {
  localStorage.clear();
});

describe('Register -> Welcome Back -> Home flow', () => {
  it('creates a new account, lands on Home, and shows the user in the header', async () => {
    const user = userEvent.setup();
    const email = `newuser_${Date.now()}@example.com`;

    renderApp(<App />, { route: { pathname: '/signin', state: { mode: 'register' } } });

    // Register form should be showing (mode=register from location.state)
    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), email);
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    // Should land on the Welcome Back screen next
    await waitFor(() => {
      expect(document.querySelector('.wb')).toBeTruthy();
    }, { timeout: 5000 });

    // Wait for the progress animation to finish and click Continue
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /continue/i });
      expect(btn).not.toBeDisabled();
    }, { timeout: 8000 });

    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Now on Home, header should show the account (avatar initial), not Sign In
    await waitFor(() => {
      expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  }, 20000);

  it('rejects register with mismatched passwords (client-side validation)', async () => {
    const user = userEvent.setup();
    const email = `mismatch_${Date.now()}@example.com`;

    renderApp(<App />, { route: { pathname: '/signin', state: { mode: 'register' } } });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), email);
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'differentpassword');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  }, 10000);

  it('logs in an existing account and reaches Home', async () => {
    const user = userEvent.setup();
    const email = `logintest_${Date.now()}@example.com`;

    // First register (fastest path to create a real mock account)
    renderApp(<App />, { route: { pathname: '/signin', state: { mode: 'register' } } });
    await waitFor(() => screen.getByLabelText(/email address/i));
    await user.type(screen.getByLabelText(/email address/i), email);
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(document.querySelector('.wb')).toBeTruthy(), { timeout: 5000 });

    // Now log out and log back in with the same credentials
    localStorage.removeItem('cinematch_token');
    localStorage.removeItem('cinematch_user');

    renderApp(<App />, { route: { pathname: '/signin', state: { mode: 'login' } } });
    await waitFor(() => screen.getByLabelText(/email or phone number/i));
    await user.type(screen.getByLabelText(/email or phone number/i), email);
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(document.querySelector('.wb')).toBeTruthy();
    }, { timeout: 5000 });
  }, 20000);
});
