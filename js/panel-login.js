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
    const creds = !quick && DEMO_ACCOUNTS[role].email === form.elements.email.value.trim().toLowerCase() && form.elements.password.value === DEMO_ACCOUNTS[role].password;
    err.textContent = quick || creds ? 'Tarayıcı oturum depolaması kullanılamıyor; demo paneli açılamadı.' : 'E-posta veya şifre hatalı (demo bilgilerini kullanın).';
    return;
  }
  window.location.href = DEMO_ACCOUNTS[role].home;
}

document.querySelectorAll('form[data-role]').forEach((form) => {
  form.addEventListener('submit', (e) => { e.preventDefault(); enter(form, false); });
  const quick = form.querySelector('[data-quick]');
  if (quick) quick.addEventListener('click', () => enter(form, true));
});

// Tabs (customer / admin) with arrow-key support.
const tabs = Array.from(document.querySelectorAll('[data-tab]'));
function selectTab(tab, focus) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) tab.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t, false));
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
  });
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
