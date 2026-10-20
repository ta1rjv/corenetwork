// Quote form: URL parameter prefill, client-side validation and submission
// (POST to CONFIG.formEndpoint when set, otherwise a mailto: draft to CONFIG.quoteEmail).
import { CONFIG } from './config.js';

const SERVICES = {
  colocation: 'Co-location',
  vds: 'VDS',
  vps: 'VPS',
  fiber: 'Fiber',
  xdsl: 'xDSL',
  radyolink: 'Radyolink',
  diger: 'Diğer',
};
// Keys are ASCII; incoming values are folded to ASCII before lookup.
const ALIASES = { 'co-location': 'colocation', colocation: 'colocation', diger: 'diger' };
const ADDRESS_SERVICES = ['fiber', 'xdsl', 'radyolink'];
const MAX_MAILTO_BODY = 1800;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Simple Turkish to ASCII fold (lower case)
function fold(s) {
  const map = { 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ı': 'i', 'ö': 'o', 'ç': 'c' };
  return s.toLowerCase().replace(/̇/g, '').replace(/[ğüşıöç]/g, (c) => map[c]);
}

export function initQuoteForm() {
  const form = document.getElementById('quote-form');
  if (!form) return;
  const status = document.getElementById('form-status');
  const boxes = Array.from(form.querySelectorAll('input[name="hizmet"]'));
  const addr = form.elements.namedItem('adres');

  // Prefill from ?hizmet=vds,fiber&adres=...
  const params = new URLSearchParams(window.location.search);
  const wanted = (params.get('hizmet') || '').split(',').map((s) => fold(s.trim())).filter(Boolean);
  wanted.forEach((w) => {
    const key = Object.hasOwn(ALIASES, w) ? ALIASES[w] : w;
    const box = boxes.find((b) => b.value === key);
    if (box) box.checked = true;
  });
  const adres = params.get('adres');
  if (adres && addr) addr.value = adres.slice(0, 500);

  function selected() {
    return boxes.filter((b) => b.checked).map((b) => b.value);
  }

  function setError(id, input, msg) {
    const p = document.getElementById(id);
    if (p) p.textContent = msg || '';
    if (input) {
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    return !msg;
  }

  function validate() {
    const f = form.elements;
    const first = [];
    const mark = (ok, el) => { if (!ok && el) first.push(el); return ok; };
    const name = f.namedItem('adSoyad');
    const mail = f.namedItem('eposta');
    const tel = f.namedItem('telefon');
    const kvkk = f.namedItem('kvkk');
    const svc = selected();

    mark(setError('e-ad', name, name.value.trim().length < 2 ? 'Lütfen adınızı ve soyadınızı yazın.' : ''), name);
    mark(setError('e-eposta', mail, !EMAIL_RE.test(mail.value.trim()) ? 'Lütfen geçerli bir e-posta adresi yazın.' : ''), mail);
    const digits = tel.value.replace(/\D/g, '');
    mark(setError('e-tel', tel, digits.length < 7 ? 'Lütfen geçerli bir telefon numarası yazın.' : ''), tel);
    mark(setError('e-hizmet', boxes[0], svc.length === 0 ? 'Lütfen en az bir hizmet seçin.' : ''), boxes[0]);
    const needAddr = svc.some((s) => ADDRESS_SERVICES.includes(s));
    mark(setError('e-adres', addr, needAddr && addr.value.trim().length < 5 ? 'İnternet hizmetleri için adres gereklidir.' : ''), addr);
    mark(setError('e-kvkk', kvkk, !kvkk.checked ? 'Devam etmek için onay vermeniz gerekir.' : ''), kvkk);

    if (first.length) first[0].focus();
    return first.length === 0;
  }

  function say(msg, kind) {
    if (!status) return;
    status.textContent = msg;
    status.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  // Clear the visible error of an edited field and reset the form-level status
  function clearFor(t) {
    if (!(t instanceof HTMLElement)) return;
    t.removeAttribute('aria-invalid');
    if (t.name === 'hizmet') {
      boxes.forEach((b) => b.removeAttribute('aria-invalid'));
      const e = document.getElementById('e-hizmet');
      if (e) e.textContent = '';
      const ea = document.getElementById('e-adres');
      if (ea) ea.textContent = '';
      if (addr) addr.removeAttribute('aria-invalid');
    } else if (t.id && t.id.indexOf('f-') === 0) {
      const e = document.getElementById('e-' + t.id.slice(2));
      if (e) e.textContent = '';
    }
    say('', '');
  }
  form.addEventListener('input', (e) => clearFor(e.target));
  form.addEventListener('change', (e) => clearFor(e.target));

  function buildText(maxBody) {
    const f = form.elements;
    const names = selected().map((s) => SERVICES[s]).join(', ');
    const head = [
      'CORENETWORK - Teklif Talebi',
      '',
      'Ad Soyad: ' + f.namedItem('adSoyad').value.trim(),
      'Firma: ' + (f.namedItem('firma').value.trim() || '-'),
      'E-posta: ' + f.namedItem('eposta').value.trim(),
      'Telefon: ' + f.namedItem('telefon').value.trim(),
      'Hizmetler: ' + names,
      'Adres: ' + (addr.value.trim() || '-'),
      '',
      'Mesaj:',
    ].join('\r\n') + '\r\n';
    let msg = f.namedItem('mesaj').value.trim() || '-';
    if (maxBody && head.length + msg.length > maxBody) {
      msg = msg.slice(0, Math.max(0, maxBody - head.length - 1)) + '…';
    }
    return { names, body: head + msg };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Honeypot: silently ignore bot submissions
    const hp = form.elements.namedItem('website');
    if (hp && hp.value) return;
    if (!validate()) {
      say('Lütfen işaretli alanları kontrol edin.', 'error');
      return;
    }

    if (CONFIG.formEndpoint) {
      const { names } = buildText(0);
      say('Gönderiliyor...', 'info');
      try {
        const data = new FormData(form);
        data.set('hizmet', names);
        data.set('konu', 'Teklif Talebi - ' + names);
        const res = await fetch(CONFIG.formEndpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        say('Talebiniz alındı. Ekibimiz en kısa sürede sizinle iletişime geçecek.', 'ok');
      } catch (_) {
        say('Talebiniz gönderilemedi. Lütfen tekrar deneyin veya ' + CONFIG.email + ' adresine yazın.', 'error');
      }
      return;
    }

    const { names, body } = buildText(MAX_MAILTO_BODY);
    const href = 'mailto:' + CONFIG.quoteEmail + '?subject=' + encodeURIComponent('Teklif Talebi - ' + names) + '&body=' + encodeURIComponent(body);
    say('E-posta uygulamanız açılmadıysa bilgilerinizi ' + CONFIG.quoteEmail + ' adresine gönderebilirsiniz.', 'info');
    window.location.href = href;
  });
}
