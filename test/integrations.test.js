'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'launchpad-test-'));
process.env.DATA_DIR = temporary;
process.env.PORT = '5198';
const realFetch = global.fetch;
let providerCalls = 0;
global.fetch = async (url, options) => {
  if (String(url).startsWith('https://remotive.com/')) {
    providerCalls++;
    return new Response(JSON.stringify({ jobs: [
      { id: 10, title: 'Junior Analyst', company_name: 'Example', candidate_required_location: 'USA', tags: ['SQL'], url: 'https://remotive.com/remote-jobs/10', category: 'Data', job_type: 'full_time' },
      { id: 11, title: 'Designer', company_name: 'Other', candidate_required_location: 'Worldwide', tags: [], url: 'https://remotive.com/remote-jobs/11' },
    ] }), { headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, options);
};
const { server, db } = require('../serve');
const ready = new Promise(resolve => server.listen(5198, '127.0.0.1', resolve));
async function request(route, method = 'GET', body, cookie, headers = {}) {
  await ready;
  return realFetch(`http://127.0.0.1:5198${route}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
}
after(async () => {
  await new Promise(resolve => server.close(resolve)); db.close(); global.fetch = realFetch;
  if (path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith('launchpad-test-')) fs.rmSync(temporary, { recursive: true });
});
test('accounts persist isolated dashboards, enforce revisions and invalidate sessions', async () => {
  assert.equal((await request('/api/state')).status, 401);
  const a = await request('/api/register', 'POST', { email: 'alpha@example.test', password: 'strong-test-pass-123', firstName: 'Alpha', lastName: 'Tester', dateOfBirth: '2001-02-03' });
  assert.equal(a.status, 200);
  const account = (await a.json()).account;
  assert.equal(account.profile.lastName, 'Tester');
  assert.equal(account.profile.dateOfBirth, '2001-02-03');
  const cookie = a.headers.get('set-cookie').split(';')[0];
  assert.match(a.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const storedSession = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(account.id);
  assert.equal(storedSession.token_hash.length, 64);
  assert.notEqual(storedSession.token_hash, cookie.split('=')[1]);
  assert.equal((await request('/api/login', 'POST', { email: account.email, password: 'incorrect-password' })).status, 401);
  const state = { profile: { name: 'Alpha', lastName: 'Tester', dateOfBirth: '2001-02-03', phone: '+1 555 0100', school: 'Example University', linkedinUrl: 'https://www.linkedin.com/in/alpha', interests: [], roles: [] }, budget: {}, daily: { done: [] }, history: {}, applications: [], interviews: [], events: [], opportunities: [], expenses: [], bills: [] };
  let response = await request('/api/state', 'PUT', { state, revision: 0, accountId: account.id }, cookie);
  assert.equal(response.status, 200); assert.equal((await response.json()).revision, 1);
  assert.equal((await request('/api/state', 'PUT', { state, revision: 0, accountId: account.id }, cookie)).status, 409);
  assert.equal((await request('/api/state', 'PUT', { state, revision: 1, accountId: 'different-account' }, cookie)).status, 409);
  assert.equal((await request('/api/state', 'PUT', { state: {}, revision: 1, accountId: account.id }, cookie)).status, 400);
  const b = await request('/api/register', 'POST', { email: 'beta@example.test', password: 'another-test-pass-123', firstName: 'Beta', lastName: 'Tester' });
  const cookieB = b.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await request('/api/state', 'GET', undefined, cookieB)).json()).state, null);
  const login = await request('/api/login', 'POST', { email: account.email, password: 'strong-test-pass-123' });
  const loggedCookie = login.headers.get('set-cookie').split(';')[0];
  const saved = await (await request('/api/state', 'GET', undefined, loggedCookie)).json();
  assert.equal(saved.state.profile.name, 'Alpha');
  assert.equal(saved.state.profile.dateOfBirth, '2001-02-03');
  assert.equal(saved.state.profile.school, 'Example University');
  state.profile.lastName = 'Updated'; state.profile.dateOfBirth = '';
  assert.equal((await request('/api/state', 'PUT', { state, revision: 1, accountId: account.id }, loggedCookie)).status, 200);
  const status = await (await request('/api/status', 'GET', undefined, loggedCookie)).json();
  assert.equal(status.account.profile.lastName, 'Updated');
  assert.equal(status.account.profile.dateOfBirth, '');
  assert.notEqual(db.prepare('SELECT hash FROM users WHERE id = ?').get(account.id).hash, 'strong-test-pass-123');
  await request('/api/logout', 'POST', {}, loggedCookie);
  assert.equal((await request('/api/state', 'GET', undefined, loggedCookie)).status, 401);
});
test('registration validates family name and optional date of birth on the server', async () => {
  const base = { email: 'invalid-profile@example.test', password: 'long-test-password-123', firstName: 'Alex', lastName: 'Example' };
  assert.equal((await request('/api/register', 'POST', { ...base, lastName: '  ' })).status, 400);
  assert.equal((await request('/api/register', 'POST', { ...base, dateOfBirth: '2999-01-01' })).status, 400);
  assert.equal((await request('/api/register', 'POST', { ...base, dateOfBirth: '2001-02-30' })).status, 400);
  const profile = require('../profile-fields');
  assert.equal(profile.validate({ dateOfBirth: '' }), '');
  assert.equal(profile.validate({ dateOfBirth: '2000-02-29' }), '');
  assert.ok(profile.validate({ dateOfBirth: '2001-02-29' }));
  assert.ok(profile.validate({ linkedinUrl: 'https://linkedin.com.example.com/in/test' }));
  assert.ok(profile.validate({ portfolioUrl: 'javascript:alert(1)' }));
  assert.equal(profile.validate({ linkedinUrl: 'https://www.linkedin.com/in/test', indeedUrl: 'https://profile.indeed.com/example', graduationYear: '2027' }), '');
});
test('blocks cross-origin writes and access to secrets, code and database', async () => {
  assert.equal((await request('/api/register', 'POST', { email: 'x@example.test', password: 'password-test-123' }, undefined, { Origin: 'https://example.com' })).status, 403);
  for (const route of ['/.env', '/.data/launchpad.sqlite', '/serve.js', '/README.md', '/%2e%2e/.env']) assert.equal((await request(route)).status, 404);
  assert.equal((await request('/integrations.js')).status, 200);
});
test('job search filters public listings and caches upstream calls', async () => {
  const first = await (await request('/api/jobs?q=analyst&location=usa')).json();
  assert.equal(first.jobs.length, 1); assert.equal(first.jobs[0].source, 'Remotive');
  assert.equal(first.jobs[0].link, 'https://remotive.com/remote-jobs/10');
  await request('/api/jobs?q=designer'); assert.equal(providerCalls, 1);
  assert.equal((await request('/api/jobs?source=usajobs')).status, 503);
});
test('calendar export handles timezone, all-day exclusive end, escaping and UTF-8 folding', () => {
  const source = fs.readFileSync(path.join(__dirname, '../integrations.js'), 'utf8');
  const calendarSource = source.slice(source.indexOf('function calendarText'), source.indexOf('Object.assign(actions'));
  const context = vm.createContext({ TextEncoder, state: {
    interviews: [{ id: 'one', when: '2026-10-29T10:00:00', company: 'Example, Inc', type: 'Video', role: 'Analyst', notes: 'First\nSecond; ' + 'é'.repeat(80) }],
    events: [{ id: 'two', date: '2026-12-31', name: 'Career fair', location: 'Hall', notes: '' }],
  }, todayISO: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, parseDay: s => new Date(s + 'T00:00:00'), addDays: (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; } });
  const ics = vm.runInContext(calendarSource + '\ncalendarExport()', context);
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
  assert.match(ics, /DTEND;VALUE=DATE:20270101/);
  assert.match(ics, /Example\\, Inc/);
  assert.match(ics, /First\\nSecond\\;/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
});
