const inboxSelect = document.getElementById('inboxSelect');
const copyBtn = document.getElementById('copyBtn');
const refreshBtn = document.getElementById('refreshBtn');
const newBtn = document.getElementById('newBtn');
const deleteBtn = document.getElementById('deleteBtn');
const newBox = document.getElementById('newBox');
const createCustomBtn = document.getElementById('createCustomBtn');
const createRandomBtn = document.getElementById('createRandomBtn');
const localPartInput = document.getElementById('localPartInput');
const domainSelect = document.getElementById('domainSelect');
const currentInbox = document.getElementById('currentInbox');
const messageCount = document.getElementById('messageCount');
const messageList = document.getElementById('messageList');
const appTitle = document.getElementById('appTitle');
const appSubtitle = document.getElementById('appSubtitle');

let appConfig = {
  appName: 'Tempik',
  mailDomain: 'example.com',
  webHost: 'tempik.example.com'
};

const SESSION_KEY = 'tempik_session_id';
let sessionId = localStorage.getItem(SESSION_KEY) || '';

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (sessionId) {
    headers['x-session-id'] = sessionId;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadConfig() {
  appConfig = await fetchJson('/api/config', { headers: {} });
  document.title = appConfig.appName;
  appTitle.textContent = appConfig.appName;
  appSubtitle.textContent = `Disposable inbox for ${appConfig.mailDomain}`;
  localPartInput.placeholder = `username atau kosongkan untuk random @${appConfig.mailDomain}`;

  // Populate domain selector
  const domains = appConfig.mailDomains || [appConfig.mailDomain];
  domainSelect.innerHTML = '';
  domains.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `@${d}`;
    domainSelect.appendChild(opt);
  });
  if (domains.length <= 1) domainSelect.style.display = 'none';
}

async function ensureSession() {
  const payload = await fetchJson('/api/session');
  sessionId = payload.sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
}

async function loadInboxes(selectedAddress) {
  const inboxes = await fetchJson('/api/inboxes');
  inboxSelect.innerHTML = '';

  if (!inboxes.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Belum ada inbox';
    inboxSelect.appendChild(opt);
    currentInbox.textContent = 'No inbox selected';
    messageList.innerHTML = '<div class="empty-state"><div class="icon">📬</div><div class="title">No inboxes yet</div><div class="sub">Click <b>New</b> to create a disposable email address.</div></div>';
    messageCount.textContent = '0 messages';
    return;
  }

  inboxes.forEach((inbox) => {
    const opt = document.createElement('option');
    opt.value = inbox.address;
    opt.textContent = inbox.address;
    inboxSelect.appendChild(opt);
  });

  inboxSelect.value = selectedAddress && inboxes.some((x) => x.address === selectedAddress)
    ? selectedAddress
    : inboxes[0].address;

  await loadMessages();
}

async function loadMessages() {
  const address = inboxSelect.value;
  if (!address) return;
  currentInbox.textContent = address;
  const messages = await fetchJson(`/api/inboxes/${encodeURIComponent(address)}/messages`);
  messageCount.textContent = `${messages.length} pesan`;

  if (!messages.length) {
    messageList.innerHTML = '<div class="empty-state"><div class="empty-title">Kotak Masuk Kosong</div><div class="empty-sub">Email yang dikirim ke alamat ini akan otomatis muncul di sini secara realtime.</div></div>';
    return;
  }

  messageList.innerHTML = messages.map((msg, idx) => {
    let contentHtml = '';
    const rawBody = msg.body || '';
    const isHtml = /<[a-z][\s\S]*>/i.test(rawBody);

    // Auto-detect OTP Code (4-8 digit)
    const textToScan = (msg.subject + ' ' + rawBody.replace(/<[^>]+>/g, ' ')).replace(/&#\d+;/g, ' ');
    const otpMatch = textToScan.match(/(?:code|kode|otp|pin|verification|verifikasi)[\s:=#*—]+([0-9]{4,8})\b/i) || textToScan.match(/\b([0-9]{6})\b/);
    const otpCode = otpMatch ? otpMatch[1] : null;

    let otpBanner = '';
    if (otpCode) {
      otpBanner = `
        <div class="otp-banner">
          <div class="otp-left">
            <span class="otp-tag">KODE OTP</span>
            <span class="otp-code">${otpCode}</span>
          </div>
          <button type="button" class="btn-copy-otp" onclick="event.stopPropagation(); copyOtp('${otpCode}')">
            <svg class="ico-svg" style="width:14px;height:14px;" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Salin Kode
          </button>
        </div>
      `;
    }

    if (isHtml) {
      const srcDoc = rawBody.replace(/"/g, '&quot;');
      contentHtml = `<iframe class="email-frame" sandbox="allow-same-origin allow-popups" srcdoc="${srcDoc}" onload="this.style.height = (this.contentWindow.document.body.scrollHeight + 30) + 'px'"></iframe>`;
    } else {
      contentHtml = `<div class="message-body"><pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(rawBody || '(Pesan kosong)')}</pre></div>`;
    }

    const initial = (msg.from_address.replace(/<.*>/, '').trim()[0] || 'M').toUpperCase();

    return `
      <div class="message-item ${idx === 0 ? 'active' : ''}" onclick="toggleDetail(this)">
        <div class="msg-header-card">
          <div class="msg-sender-row">
            <div class="msg-avatar">${initial}</div>
            <div class="msg-sender-info">
              <div class="msg-from-name">${escapeHtml(msg.from_address)}</div>
              <div class="msg-date-pill">${new Date(msg.received_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</div>
            </div>
            <div class="msg-toggle-btn">
              <span class="msg-state-text">${idx === 0 ? 'Tutup' : 'Buka'}</span>
              <svg class="msg-chevron ico-svg" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="msg-subject-row">${escapeHtml(msg.subject || '(Tanpa Subjek)')}</div>
        </div>

        <div class="message-detail">
          ${otpBanner}
          ${contentHtml}
        </div>
      </div>
    `;
  }).join('');
}

function copyOtp(code) {
  navigator.clipboard.writeText(code).then(() => showToast(`Kode OTP ${code} disalin!`));
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleDetail(el) {
  const isActive = el.classList.contains('active');
  document.querySelectorAll('.message-item').forEach(m => {
    m.classList.remove('active');
    const txt = m.querySelector('.msg-state-text');
    if (txt) txt.textContent = 'Buka';
  });
  if (!isActive) {
    el.classList.add('active');
    const txt = el.querySelector('.msg-state-text');
    if (txt) txt.textContent = 'Tutup';
  }
}

function showToast(text) {
  const tc = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  tc.appendChild(el);
  setTimeout(() => { el.classList.add('fadeout'); setTimeout(() => el.remove(), 200); }, 1800);
}

copyBtn.addEventListener('click', async () => {
  if (!inboxSelect.value) return;
  await navigator.clipboard.writeText(inboxSelect.value);
  showToast('Alamat email berhasil disalin!');
});

refreshBtn.addEventListener('click', loadMessages);
newBtn.addEventListener('click', () => newBox.classList.toggle('hidden'));
inboxSelect.addEventListener('change', loadMessages);

deleteBtn.addEventListener('click', async () => {
  if (!inboxSelect.value) return;
  if (!confirm(`Delete inbox ${inboxSelect.value}?`)) return;
  const target = inboxSelect.value;
  await fetchJson(`/api/inboxes/${encodeURIComponent(target)}`, { method: 'DELETE' });
  await loadInboxes();
});

createCustomBtn.addEventListener('click', async () => {
  const localPart = localPartInput.value.trim();
  const domain = domainSelect.value;
  const inbox = await fetchJson('/api/inboxes', {
    method: 'POST',
    body: JSON.stringify({ localPart, domain })
  });
  localPartInput.value = '';
  newBox.classList.add('hidden');
  await loadInboxes(inbox.address);
});

createRandomBtn.addEventListener('click', async () => {
  const domain = domainSelect.value;
  const inbox = await fetchJson('/api/inboxes', {
    method: 'POST',
    body: JSON.stringify({ domain })
  });
  localPartInput.value = '';
  newBox.classList.add('hidden');
  await loadInboxes(inbox.address);
});

Promise.all([loadConfig(), ensureSession()]).then(() => loadInboxes()).catch((err) => {
  console.error(err);
  messageList.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><div class="title">Connection error</div><div class="sub">${err.message}</div></div>`;
});
