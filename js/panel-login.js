// Demo login page logic. Client-side demo only; see js/demo-auth.js.
import { login, startSession, DEMO_ACCOUNTS, currentRole } from './demo-auth.js';

async function enter(form, quick) {
  const role = form.dataset.role;
  const err = form.querySelector('.err');
  err.textContent = '';
  const ok = quick
    ? await startSession(role)
    : await login(role, form.elements.email.value, form.elements.password.value);
  if (!ok) {
    err.textContent = quick ? 'Tarayıcı oturum depolaması kullanılamıyor; demo paneli açılamadı.' : 'E-posta veya şifre hatalı (demo bilgilerini kullanın).';
    return;
  }
  window.location.href = DEMO_ACCOUNTS[role].home;
}

document.querySelectorAll('form[data-role]').forEach((form) => {
  form.addEventListener('submit', (e) => { e.preventDefault(); enter(form, false); });
  const quick = form.querySelector('[data-quick]');
  if (quick) quick.addEventListener('click', () => enter(form, true));
});

// Already signed in: offer a direct link instead of redirecting.
const role = currentRole();
if (role) {
  const note = document.querySelector('.login-note');
  const a = document.createElement('a');
  a.href = DEMO_ACCOUNTS[role].home;
  a.textContent = ` Açık oturum: ${DEMO_ACCOUNTS[role].label} paneline devam et.`;
  note.appendChild(a);
}
