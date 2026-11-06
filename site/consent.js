// Cookie banner, shown only to visitors who have to opt in (EU/EEA, UK, CH,
// or unknown country; see netlify/edge-functions/geo-consent.js).
// Everyone else already has analytics loaded by the snippet in <head>.
const KEY = 'fsj.consent';
const needsConsent = document.documentElement.dataset.consent !== 'not-required';

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function remember(choice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Can't remember; we'll ask again next visit.
  }
}

function showBanner() {
  if (document.getElementById('cookie-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie choice');
  banner.innerHTML = `
    <p>🍪 Can we use cookies for anonymous analytics? It helps us see which features are worth building. No ads, no selling your data.</p>
    <div class="cookie-actions">
      <button type="button" class="btn btn-ink" data-choice="granted">Sure</button>
      <button type="button" class="btn" data-choice="denied">No thanks</button>
    </div>`;
  banner.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-choice]')?.dataset.choice;
    if (!choice) return;
    remember(choice);
    if (choice === 'granted') window.fsjLoadGTM?.();
    banner.remove();
  });
  document.body.append(banner);
}

if (needsConsent) {
  if (!stored()) showBanner();
  // Let people change their mind from the footer.
  const footer = document.querySelector('.site-footer .wrap');
  if (footer) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'link-button';
    link.textContent = 'Cookie settings';
    link.addEventListener('click', showBanner);
    footer.append(link);
  }
}
