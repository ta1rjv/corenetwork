// ============================================================================
// DEMO AUTH - client-side only, NOT real authentication.
// The credentials below are public (they are printed on giris.html) and the
// "session" is just a flag in sessionStorage. Anyone can set it from the
// browser console. This module is the single seam to replace with real
// server-side authentication when the panels become a real application.
// ============================================================================
const SESSION_KEY = 'corenetwork-demo:session';

export const DEMO_ACCOUNTS = {
  customer: { email: 'musteri@demo.local', password: 'demo', label: 'Müşteri', home: 'musteri-paneli.html' },
  admin: { email: 'yonetici@demo.local', password: 'demo', label: 'Yönetici', home: 'yonetim-paneli.html' },
};

function readFlag() {
  try { return window.sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
}

/** Returns 'customer', 'admin' or null. */
export function currentRole() {
  const v = readFlag();
  return v === 'customer' || v === 'admin' ? v : null;
}

/** Checks the demo credentials. Resolves to the role or null. */
export async function login(role, email, password) {
  const acc = DEMO_ACCOUNTS[role];
  if (!acc || email.trim().toLowerCase() !== acc.email || password !== acc.password) return null;
  return startSession(role);
}

/**
 * Sets the session flag in sessionStorage and reads it back. Resolves to the role, or null
 * when the browser blocks sessionStorage (there is no in-memory fallback: it would not
 * survive the page navigation to the panel).
 */
export async function startSession(role) {
  if (!DEMO_ACCOUNTS[role]) return null;
  try {
    window.sessionStorage.setItem(SESSION_KEY, role);
    return window.sessionStorage.getItem(SESSION_KEY) === role ? role : null;
  } catch (e) { return null; }
}

export async function logout() {
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}

/** Guard for panel pages: redirects to the login page when the role does not match. */
export function requireRole(role) {
  if (currentRole() === role) return true;
  window.location.replace('giris.html');
  return false;
}
