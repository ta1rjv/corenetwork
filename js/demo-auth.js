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

let memorySession = null;

function readFlag() {
  try {
    const v = window.sessionStorage.getItem(SESSION_KEY);
    if (v) return v;
  } catch (e) { /* storage blocked: fall back to memory */ }
  return memorySession;
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

/** Sets the session flag. Resolves to the role, or null if it could not be kept. */
export async function startSession(role) {
  if (!DEMO_ACCOUNTS[role]) return null;
  memorySession = role;
  try { window.sessionStorage.setItem(SESSION_KEY, role); } catch (e) { /* memory only */ }
  return currentRole() === role ? role : null;
}

export async function logout() {
  memorySession = null;
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}

/** Guard for panel pages: redirects to the login page when the role does not match. */
export function requireRole(role) {
  if (currentRole() === role) return true;
  window.location.replace('giris.html');
  return false;
}
