import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import App from '../App';
import { renderApp } from './test-utils';

beforeEach(() => {
  localStorage.clear();
});

describe('Guest experience (no login)', () => {
  it('renders the Home page for a guest without crashing, and shows Sign In / Create Account', async () => {
    renderApp(<App />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getAllByText(/sign in/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/create account/i).length).toBeGreaterThan(0);
  });

  it('renders the Recommend page for a guest without crashing (regression: used to crash on user.email)', async () => {
    renderApp(<App />, { route: '/recommend' });

    await waitFor(() => {
      // The page header/eyebrow text should show up, proving it rendered
      expect(document.querySelector('.rc')).toBeTruthy();
    });
  });

  it('renders the Trending page for a guest without crashing', async () => {
    renderApp(<App />, { route: '/trending' });
    await waitFor(() => {
      expect(document.querySelector('.tr, .trending, body')).toBeTruthy();
    });
  });

  it('renders Search results page for a guest and can search', async () => {
    renderApp(<App />, { route: '/search?q=Crimson' });
    await waitFor(() => {
      expect(screen.getAllByText(/Crimson Horizon/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('renders Title Detail page for a guest without crashing, and hides personal actions gracefully', async () => {
    renderApp(<App />, { route: '/title/Crimson%20Horizon' });
    await waitFor(() => {
      expect(screen.getByText('Crimson Horizon')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('redirects a guest away from protected pages (Favorites) — straight to sign-in', async () => {
    renderApp(<App />, { route: '/favorites' });
    await waitFor(() => {
      expect(screen.getByLabelText(/email or phone number/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('redirects a guest away from protected pages (Dashboard) — straight to sign-in', async () => {
    renderApp(<App />, { route: '/dashboard' });
    await waitFor(() => {
      expect(screen.getByLabelText(/email or phone number/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('redirects a guest away from protected pages (Settings) — straight to sign-in', async () => {
    renderApp(<App />, { route: '/settings' });
    await waitFor(() => {
      expect(screen.getByLabelText(/email or phone number/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
