import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { renderApp } from './test-utils';

const EMAIL = 'seeded_user@example.com';

function seedAuthenticatedSession() {
  localStorage.setItem('cinematch_token', 'mock_token_seeded');
  localStorage.setItem('cinematch_user', JSON.stringify({ id: 1, email: EMAIL, stage: 'stranger' }));
}

beforeEach(() => {
  localStorage.clear();
  seedAuthenticatedSession();
});

describe('Authenticated user — Favorites & Watch History', () => {
  it('shows the logged-in header (no Sign In button) once seeded, with Dashboard button visible', async () => {
    renderApp(<App />, { route: '/home' });
    await waitFor(() => {
      expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: /^dashboard$/i }).length).toBeGreaterThan(0);
  });

  it('adds a title to My List from the Title Detail page — persists correctly in storage', async () => {
    const user = userEvent.setup();
    renderApp(<App />, { route: '/title/Crimson%20Horizon' });

    await screen.findByText('Crimson Horizon', {}, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: /add to my list/i }));
    await screen.findByRole('button', { name: /in my list/i }, { timeout: 2000 });

    // Verify the underlying data was actually persisted correctly (the source of truth)
    const stored = JSON.parse(localStorage.getItem('cinematch_mock_favorites'));
    expect(stored[EMAIL]).toHaveLength(1);
    expect(stored[EMAIL][0].title).toBe('Crimson Horizon');
    expect(stored[EMAIL][0].type).toBe('TV Show');

    // And the Favorites page genuinely reflects it
    renderApp(<App />, { route: '/favorites' });
    const names = await screen.findAllByText('Crimson Horizon', {}, { timeout: 3000 });
    expect(names.length).toBeGreaterThan(0);
  }, 15000);

  it('marks a title as watched — persists correctly and shows on History page', async () => {
    const user = userEvent.setup();
    renderApp(<App />, { route: '/title/Echoes%20of%20Tomorrow' });

    await screen.findByText('Echoes of Tomorrow', {}, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: /mark as watched/i }));
    await screen.findByRole('button', { name: /^watched$/i }, { timeout: 2000 });

    const stored = JSON.parse(localStorage.getItem('cinematch_mock_history'));
    expect(stored[EMAIL]).toHaveLength(1);
    expect(stored[EMAIL][0].title).toBe('Echoes of Tomorrow');

    renderApp(<App />, { route: '/history' });
    const names = await screen.findAllByText('Echoes of Tomorrow', {}, { timeout: 3000 });
    expect(names.length).toBeGreaterThan(0);
  }, 15000);

  it('removes a title from Favorites and the underlying storage updates', async () => {
    const user = userEvent.setup();

    renderApp(<App />, { route: '/title/The%20Last%20Ember' });
    await screen.findByText('The Last Ember', {}, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: /add to my list/i }));
    await screen.findByRole('button', { name: /in my list/i });

    let stored = JSON.parse(localStorage.getItem('cinematch_mock_favorites'));
    expect(stored[EMAIL]).toHaveLength(1);

    renderApp(<App />, { route: '/favorites' });
    await screen.findAllByText('The Last Ember', {}, { timeout: 3000 });

    const removeBtn = document.querySelector('.mlc__action--danger');
    expect(removeBtn).toBeTruthy();
    await user.click(removeBtn);

    await waitFor(() => {
      stored = JSON.parse(localStorage.getItem('cinematch_mock_favorites'));
      expect(stored[EMAIL]).toHaveLength(0);
    }, { timeout: 3000 });
  }, 15000);

  it('renders the Settings page with the account email and a working sign-out', async () => {
    const user = userEvent.setup();
    renderApp(<App />, { route: '/settings' });

    await waitFor(() => {
      expect(document.querySelector('.settings-row__value')?.textContent).toBe(EMAIL);
    }, { timeout: 3000 });

    const signOutBtn = within(document.querySelector('.settings-card--danger')).getByRole('button', { name: /sign out/i });
    await user.click(signOutBtn);

    await waitFor(() => {
      expect(localStorage.getItem('cinematch_token')).toBeNull();
    }, { timeout: 3000 });
  }, 15000);

  it('renders the Dashboard page without crashing for an authenticated user', async () => {
    renderApp(<App />, { route: '/dashboard' });
    await waitFor(() => {
      expect(document.body.textContent.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  }, 10000);
});
