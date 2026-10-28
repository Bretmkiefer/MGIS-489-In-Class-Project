'use strict';
const connection = { account: null, online: false, revision: 0, message: 'Checking the local server…', busy: false, dirty: false, blocked: false, usajobs: false };
let accountReady = false;
let authChecked = false;
let authMode = 'login';
window.launchpadRenderGate = () => {
  const signedIn = Boolean(connection.account && accountReady);
  const publicJobs = !signedIn && location.hash === '#jobs';
  document.body.classList.toggle('auth-screen', !signedIn && !publicJobs);
  document.body.classList.toggle('public-jobs', publicJobs);
  const accountNav = $('#account-nav');
  if (publicJobs) {
    accountNav.innerHTML = '<a class="btn ghost" href="#overview">Sign in</a>';
    return false;
  }
  if (signedIn) {
    accountNav.innerHTML = `<a href="#connections" class="account-email" title="${esc(connection.account.email)}">${esc(connection.account.email)}</a><button class="btn ghost" data-header-logout ${connection.busy ? 'disabled' : ''}>Sign out</button>`;
    return false;
  }
  accountNav.innerHTML = '';
  if (!authChecked) {
    app.innerHTML = '<div class="auth-loading" role="status">Loading your workspace…</div>';
    return true;
  }
  const register = authMode === 'register';
  document.title = `${register ? 'Create account' : 'Sign in'} · Student Launchpad`;
  app.innerHTML = `<div class="auth-layout">
    <section class="auth-intro"><a class="auth-brand" href="#overview"><span class="logo" aria-hidden="true">▲</span> Student Launchpad</a><p class="eyebrow">YOUR NEXT CHAPTER</p><h1>A place for your plans.</h1><p>Keep your job search, interviews, and everyday budget together in your own workspace.</p><ul><li>Track applications and upcoming interviews.</li><li>Find real job opportunities.</li><li>Keep your budget in view.</li></ul></section>
    <section class="auth-card" aria-labelledby="auth-title"><p class="eyebrow">${register ? 'GET STARTED' : 'WELCOME BACK'}</p><h2 id="auth-title">${register ? 'Create your account' : 'Sign in to Launchpad'}</h2><p class="muted">${register ? 'Your own dashboard, saved separately from everyone else’s.' : 'Pick up where you left off.'}</p>
    <form id="account-form" class="integration-form" data-mode="${authMode}">
      ${register ? `<div class="registration-names"><div class="field"><label for="account-name">First name</label><input id="account-name" autocomplete="given-name" maxlength="60" required></div><div class="field"><label for="account-last-name">Last name</label><input id="account-last-name" autocomplete="family-name" maxlength="60" required></div></div><div class="field"><label for="account-dob">Date of birth <span class="optional">(optional)</span></label><input id="account-dob" type="date" autocomplete="bday" min="1900-01-01" max="${todayISO()}"><p class="hint">Not required to connect job accounts.</p></div>` : ''}
      <div class="field"><label for="account-email">Email</label><input id="account-email" type="email" autocomplete="username" maxlength="254" required></div>
      <div class="field"><label for="account-password">Password</label><input id="account-password" type="password" minlength="10" maxlength="128" autocomplete="${register ? 'new-password' : 'current-password'}" required>${register ? '<p class="hint">Use 10–128 characters.</p>' : ''}</div>
      ${register ? '<div class="field"><label for="account-confirm">Confirm password</label><input id="account-confirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></div>' : ''}
      <p id="account-message" role="status">${esc(connection.online ? connection.message.startsWith('Guest mode') ? '' : connection.message : 'The server is unavailable. Please retry in a moment.')}</p>
      <button class="btn primary auth-submit" type="submit" ${connection.online ? '' : 'disabled'}>${register ? 'Create account' : 'Sign in'}</button>
    </form>
    <p class="auth-switch">${register ? 'Already have an account?' : 'New to Launchpad?'} <button class="text-button" data-action="auth-mode" data-mode="${register ? 'login' : 'register'}">${register ? 'Sign in' : 'Create an account'}</button></p>
    <p class="auth-browse"><a href="#jobs">Browse public jobs</a></p>
    ${!connection.online ? '<button class="btn" data-action="connect-retry">Retry connection</button>' : ''}
    <p class="auth-footnote">Accounts save to this Launchpad server. Email verification and password recovery are not available yet.</p></section>
    </div>`;
  return true;
};
$('#account-nav').addEventListener('click', e => { if (e.target.closest('[data-header-logout]')) actions.logout(); });
let syncTimer;
let jobResults = [];
let jobSearch = { query: '', location: '', source: 'remotive', message: '', busy: false };
const guestSnapshot = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } };
async function api(route, method = 'GET', value) {
  const response = await fetch(route, { method, credentials: 'same-origin', headers: value === undefined ? {} : { 'Content-Type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: response.status });
  return data;
}
function refreshConnections() { if (currentView() === 'connections') render(); }
function normalizeDashboard(data) {
  const base = defaultState();
  return { ...base, ...data, profile: { ...base.profile, ...data?.profile }, budget: { ...base.budget, ...data?.budget } };
}
window.launchpadSync = () => {
  if (!connection.account) return;
  connection.dirty = true;
  connection.message = 'Unsaved changes';
  try { localStorage.setItem(`${accountKey()}:pending`, JSON.stringify({ state, revision: connection.revision })); } catch { /* save() already reports local storage errors */ }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncAccount, 450);
};
async function syncAccount() {
  if (!connection.account || connection.busy || !connection.dirty || connection.blocked) return;
  connection.busy = true;
  const savingAccount = connection.account.id;
  connection.dirty = false;
  connection.message = 'Saving…';
  refreshConnections();
  try {
    const result = await api('/api/state', 'PUT', { state, revision: connection.revision, accountId: connection.account.id });
    if (connection.account?.id !== savingAccount) return;
    connection.revision = result.revision;
    if (!connection.dirty) localStorage.removeItem(`${accountKey()}:pending`);
    else localStorage.setItem(`${accountKey()}:pending`, JSON.stringify({ state, revision: connection.revision }));
    connection.message = 'Saved to this local server';
  } catch (err) {
    if (connection.account?.id !== savingAccount) return;
    connection.dirty = true;
    connection.blocked = err.status === 409;
    connection.message = err.message;
    if (err.status === 401) { accountReady = false; connection.message = 'Your session expired. Sign in again to continue.'; render(); }
    toast('Server save failed. Your browser copy is preserved. Open Connections.');
  } finally {
    connection.busy = false;
    refreshConnections();
    if (connection.dirty && !connection.blocked && connection.message === 'Saved to this local server') syncTimer = setTimeout(syncAccount, 50);
  }
}
function accountKey() { return `${STORE_KEY}:account:${connection.account.id}`; }
async function loadAccount(discardPending = false) {
  const saved = await api('/api/state');
  let pending;
  try { pending = JSON.parse(localStorage.getItem(`${accountKey()}:pending`)); } catch { /* no pending backup */ }
  if (discardPending) { localStorage.removeItem(`${accountKey()}:pending`); pending = null; }
  connection.revision = saved.revision;
  state = pending?.state ? normalizeDashboard(pending.state) : saved.state ? normalizeDashboard(saved.state) : normalizeDashboard({ profile: connection.account.profile || {} });
  window.launchpadStorageKey = accountKey();
  connection.dirty = Boolean(pending);
  connection.blocked = Boolean(pending && pending.revision !== saved.revision);
  connection.message = saved.state ? 'Saved dashboard loaded' : 'New account ready. Import your guest dashboard below if you want to keep it.';
  if (pending) connection.message = connection.blocked ? 'Recovered unsaved browser copy. The server also changed. Export this copy before reloading the saved version.' : 'Recovered unsaved browser copy. Select Retry save to save it.';
  localStorage.setItem(accountKey(), JSON.stringify(state));
  accountReady = true;
  render();
}
async function initializeConnections() {
  authChecked = false;
  accountReady = false;
  render();
  try {
    const status = await api('/api/status');
    connection.online = true;
    connection.usajobs = status.usajobs;
    connection.account = status.account;
    if (status.account) await loadAccount();
    else connection.message = 'Guest mode · saved in this browser';
  } catch {
    connection.online = false;
    connection.message = 'Backend unavailable. Start the app with Node.js to use accounts and live search.';
  }
  authChecked = true;
  render();
}
function renderConnections() {
  const accountPanel = `
    <p>Signed in as <strong>${esc(connection.account.email)}</strong></p>
    <p class="connection-status" role="status">${esc(connection.message)}</p>
    <div class="data-actions">
      <button class="btn" data-action="sync-account" ${connection.busy || connection.blocked ? 'disabled' : ''}>Retry save</button>
      <button class="btn" data-action="reload-account" ${connection.busy ? 'disabled' : ''}>Reload saved version</button>
      <button class="btn" data-action="import-guest" ${connection.busy ? 'disabled' : ''}>Copy guest dashboard into account</button>
      <button class="btn ghost" data-action="logout" ${connection.busy ? 'disabled' : ''}>Sign out</button>
    </div>`;
  return `${pageHead('Connections', 'Real job sources, calendar exports, and your saved dashboard.')}
    <div class="stack">
      <section class="panel"><h2>Your account</h2>${accountPanel}<p class="hint">Your saved account data stays on this Launchpad server. Each account has a separate dashboard. Keep an exported backup of your data.</p><button class="btn ghost" data-action="export">Export current dashboard</button></section>
      <div class="grid-2">
        <section class="panel"><h2>Job sources</h2><dl class="connection-list"><div><dt>Remotive</dt><dd>Public remote listings · no account required. Refreshed every six hours; provider listings are delayed by 24 hours.</dd></div><div><dt>USAJOBS</dt><dd>${connection.usajobs ? 'Configured. Search federal jobs on Opportunities.' : 'Not configured. The server owner needs to enable federal job search.'}</dd></div><div><dt>LinkedIn & Indeed</dt><dd>Search links and manual tracking. No personal-account or application-status sync.</dd></div></dl><a class="btn primary" href="#opportunities">Find opportunities</a></section>
        <section class="panel"><h2>Your calendar</h2><p class="muted">Download interviews and career events as an .ics file for Google Calendar, Outlook, or Apple Calendar. Interviews use this computer’s local timezone; career events are all-day.</p><div class="data-actions"><button class="btn primary" data-action="calendar-export">Download calendar</button></div><p class="hint">One-time export. Later edits do not sync automatically.</p></section>
      </div>
      <section class="panel"><h2>Google Calendar & Gmail account sync</h2><p class="muted">Not available yet. This version does not read your email or sync directly with Google Calendar. You can use the calendar download above.</p></section>
    </div>`;
}
const savedOpportunitiesView = VIEWS.opportunities;
VIEWS.connections = renderConnections;
VIEWS.opportunities = () => {
  const query = jobSearch.query || (accountReady ? state.profile.roles[0] : '') || '';
  const links = `<div class="data-actions"><a class="btn" target="_blank" rel="noopener" href="https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords: query, location: jobSearch.location })}">Search LinkedIn ↗</a><a class="btn" target="_blank" rel="noopener" href="https://www.indeed.com/jobs?${new URLSearchParams({ q: query, l: jobSearch.location })}">Search Indeed ↗</a></div>`;
  return `${pageHead('Opportunities', 'Search real postings and keep your application shortlist here.')}<div class="stack"><section class="panel"><h2>Find real jobs</h2><p class="muted">Search a job feed or open a search on LinkedIn and Indeed. Save a result here, then track it when you are ready.</p>
    <form id="job-search-form" class="job-search-form">
      <div class="field"><label for="job-query">Role or keywords</label><input id="job-query" value="${esc(query)}" maxlength="100" placeholder="e.g. analyst"></div>
      <div class="field"><label for="job-location">Location</label><input id="job-location" value="${esc(jobSearch.location)}" maxlength="100" placeholder="e.g. USA or Worldwide"></div>
      <div class="field"><label for="job-source">Source</label><select id="job-source"><option value="remotive" ${jobSearch.source === 'remotive' ? 'selected' : ''}>Remotive · remote</option><option value="usajobs" ${jobSearch.source === 'usajobs' ? 'selected' : ''}>USAJOBS · federal</option></select></div>
      <button class="btn primary" type="submit" ${jobSearch.busy ? 'disabled' : ''}>${jobSearch.busy ? 'Searching…' : 'Search jobs'}</button>
    </form>${links}<p class="hint">External search links use the submitted keywords. Remotive location filters describe eligibility, not office location.</p><p role="status" class="connection-status">${esc(jobSearch.message)}</p>
    ${jobResults.length ? `<div class="cards">${jobResults.map(j => `<article class="panel opp"><h3>${esc(j.title)}</h3><p class="sub">${esc(j.company)} · ${esc(j.location)}</p><p class="sub">${esc(j.description)}${j.salary ? ` · ${esc(j.salary)}` : ''}</p><p class="hint">Source: <a href="${esc(safeUrl(j.link))}" target="_blank" rel="noopener">${esc(j.source)}</a></p><div class="opp-actions">${accountReady ? `<button class="btn primary" data-action="save-live-job" data-id="${esc(j.id)}" ${state.opportunities.some(o => o.id === j.id || o.link === j.link) ? 'disabled' : ''}>${state.opportunities.some(o => o.id === j.id || o.link === j.link) ? 'Saved' : 'Save opportunity'}</button>` : '<a class="btn primary" href="#overview">Sign in to save</a>'}<a class="btn" href="${esc(safeUrl(j.link))}" target="_blank" rel="noopener">View posting ↗</a></div></article>`).join('')}</div>` : ''}
    </section>${accountReady ? `<section>${savedOpportunitiesView(true)}</section>` : ''}</div>`;
};
VIEWS.jobs = VIEWS.opportunities;
function downloadFile(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function calendarText(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r/g, ''); }
function foldCalendarLine(line) {
  const encoder = new TextEncoder(); let result = ''; let length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) { result += '\r\n '; length = 1; }
    result += char; length += bytes;
  }
  return result;
}
function calendarExport() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Student Launchpad//Career Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const utc = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (const i of state.interviews) {
    const start = new Date(i.when); if (Number.isNaN(start.getTime())) continue;
    lines.push('BEGIN:VEVENT', `UID:interview-${calendarText(i.id)}@student-launchpad`, `DTSTAMP:${stamp}`, `DTSTART:${utc(start)}`, `DTEND:${utc(new Date(start.getTime() + 3600000))}`, `SUMMARY:${calendarText(`${i.type} interview · ${i.company}`)}`, `DESCRIPTION:${calendarText([i.role, i.contact, i.notes].filter(Boolean).join('\n'))}`, 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Interview reminder', 'END:VALARM', 'END:VEVENT');
  }
  for (const e of state.events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const next = todayISO(addDays(parseDay(e.date), 1));
    lines.push('BEGIN:VEVENT', `UID:event-${calendarText(e.id)}@student-launchpad`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.date.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${next.replaceAll('-', '')}`, `SUMMARY:${calendarText(e.name)}`, `LOCATION:${calendarText(e.location)}`, `DESCRIPTION:${calendarText(e.notes)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}
Object.assign(actions, {
  'auth-mode': el => { authMode = el.dataset.mode; connection.message = ''; render(); },
  'connect-retry': () => initializeConnections(),
  'sync-account': () => { connection.dirty = true; syncAccount(); },
  'reload-account': async () => {
    if (!await confirmAction('Reload the saved dashboard?', 'Unsaved changes in this tab will be replaced. Export a backup first if you want to keep them.', 'Reload')) return;
    try { clearTimeout(syncTimer); await loadAccount(true); } catch (err) { toast(err.message); }
  },
  'import-guest': async () => {
    const guest = guestSnapshot();
    if (!guest) return toast('There is no guest dashboard saved in this browser.');
    if (!await confirmAction('Copy your guest dashboard?', 'This replaces this account’s current dashboard with the guest data from this browser.', 'Copy dashboard')) return;
    state = normalizeDashboard(guest); save(); render();
  },
  logout: async () => {
    if (connection.dirty && !await confirmAction('Sign out with unsaved changes?', 'Your account browser backup remains on this device. Export it before signing out if needed.', 'Sign out')) return;
    try {
      await api('/api/logout', 'POST', {}); clearTimeout(syncTimer);
      connection.account = null; connection.dirty = false; connection.blocked = false;
      accountReady = false;
      window.launchpadStorageKey = null; state = defaultState();
      jobResults = []; jobSearch = { query: '', location: '', source: 'remotive', message: '', busy: false };
      connection.message = 'You have signed out.'; authMode = 'login'; render();
      localStorage.setItem('launchpad:auth-change', uid());
    } catch (err) { toast(err.message); }
  },
  'save-live-job': el => {
    if (!accountReady || !connection.account) return;
    const job = jobResults.find(j => j.id === el.dataset.id);
    if (!job || state.opportunities.some(o => o.id === job.id || o.link === job.link)) return;
    state.opportunities.push({ ...job }); save(); render(); toast('Opportunity saved. Use Track application to add it to your pipeline.');
  },
  'calendar-export': () => {
    if (!state.interviews.length && !state.events.length) return toast('Add an interview or career event first.');
    downloadFile(calendarExport(), 'launchpad-calendar.ics', 'text/calendar;charset=utf-8');
    toast('Calendar downloaded. Import it into your calendar app.');
  },
});
app.addEventListener('submit', async e => {
  if (!['account-form', 'job-search-form', 'profile-details-form'].includes(e.target.id)) return;
  e.preventDefault();
  if (e.target.id === 'profile-details-form') {
    const details = Object.fromEntries(LaunchpadProfile.fields.map(f => [f.key, $(`#personal-${f.key}`).value.trim()]));
    const error = LaunchpadProfile.validate(details);
    if (error) { $('#profile-details-message').textContent = error; return; }
    state.profile = { ...state.profile, ...details };
    save(); $('#profile-details-message').textContent = 'Profile details saved in this browser. Your account save is queued.';
    toast('Profile details updated'); return;
  }
  if (e.target.id === 'account-form') {
    const email = $('#account-email').value; const password = $('#account-password').value;
    const register = e.target.dataset.mode === 'register';
    const name = $('#account-name')?.value.trim();
    const lastName = $('#account-last-name')?.value.trim();
    const dateOfBirth = $('#account-dob')?.value || '';
    if (register) {
      const error = LaunchpadProfile.validate({ name, lastName, dateOfBirth }, true);
      if (error) { $('#account-message').textContent = error; return; }
    }
    if (register && password !== $('#account-confirm').value) { $('#account-message').textContent = 'The passwords do not match.'; $('#account-confirm').focus(); return; }
    const buttons = e.target.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
    $('#account-message').textContent = 'Connecting…';
    try {
      const result = await api(register ? '/api/register' : '/api/login', 'POST', { email, password, ...(register ? { firstName: name, lastName, dateOfBirth } : {}) });
      connection.account = result.account;
      await loadAccount();
      if (register && name) { state.profile.name = name; save(); }
      localStorage.setItem('launchpad:auth-change', uid());
      render(); toast(register ? 'Your account is ready.' : 'Welcome back.');
    } catch (err) {
      if ($('#account-message')) $('#account-message').textContent = err.message;
      buttons.forEach(b => b.disabled = false);
    }
  } else {
    jobSearch.query = $('#job-query').value.trim(); jobSearch.location = $('#job-location').value.trim(); jobSearch.source = $('#job-source').value;
    jobSearch.busy = true; jobSearch.message = 'Searching the provider…'; jobResults = []; render();
    try {
      const result = await api(`/api/jobs?${new URLSearchParams({ q: jobSearch.query, location: jobSearch.location, source: jobSearch.source })}`);
      jobResults = result.jobs;
      jobSearch.message = `${jobResults.length} result${jobResults.length === 1 ? '' : 's'} shown${result.total > jobResults.length ? ` of ${result.total}` : ''} · ${result.source} · fetched ${new Date(result.fetchedAt).toLocaleString()}`;
      if (!jobResults.length) jobSearch.message = 'No results. Try broader keywords or remove the location filter.';
    } catch (err) { jobSearch.message = err.message; }
    finally { jobSearch.busy = false; render(); }
  }
});
window.addEventListener('beforeunload', e => { if (connection.account && connection.dirty) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('storage', e => {
  if (e.key !== 'launchpad:auth-change') return;
  clearTimeout(syncTimer);
  accountReady = false;
  connection.account = null;
  connection.dirty = false;
  jobResults = [];
  jobSearch = { query: '', location: '', source: 'remotive', message: '', busy: false };
  state = defaultState();
  initializeConnections();
});
render();
initializeConnections();
