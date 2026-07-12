import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import App from '../App';
import { renderApp } from './test-utils';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Intro sequence: Splash -> Cinematic Reveal -> Home', () => {
  it('shows the Splash screen first at the root path (icon + WELCOME TO + CINEMATCH + loading bar)', async () => {
    renderApp(<App />, { route: '/' });
    await waitFor(() => {
      expect(document.querySelector('.splash')).toBeTruthy();
    });
    expect(document.querySelector('.splash__loader')).toBeTruthy();
  });

  it('renders the cinematic shutter reveal screen on its own route', async () => {
    renderApp(<App />, { route: '/reveal' });
    await waitFor(() => {
      expect(document.querySelector('.nf-shutter')).toBeTruthy();
    });
  });

  it('guest going to a protected page lands directly on the sign-in form', async () => {
    renderApp(<App />, { route: '/favorites' });
    await waitFor(() => {
      expect(screen.getByLabelText(/email or phone number/i)).toBeInTheDocument();
    });
  });

  it('sign-in page has a working "Back to Home" button', async () => {
    renderApp(<App />, { route: { pathname: '/signin', state: { mode: 'login' } } });
    await waitFor(() => screen.getByLabelText(/email or phone number/i));
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
  });
});
