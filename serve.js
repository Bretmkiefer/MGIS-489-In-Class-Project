'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');
const scrypt = promisify(crypto.scrypt);
const profileFields = require('./profile-fields');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const dataDir = process.env.DATA_DIR || path.join(__dirname, '.data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'launchpad.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dashboards (user_id TEXT PRIMARY KEY, body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);`);
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'registration_profile')) db.exec("ALTER TABLE users ADD COLUMN registration_profile TEXT NOT NULL DEFAULT '{}'");
const attempts = new Map();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5173);
const files = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/profile-fields.js': 'profile-fields.js', '/integrations.js': 'integrations.js', '/styles.css': 'styles.css' };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let jobsCache = null;
let jobsPending = null;
function json(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'JSON required.');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) fail(413, 'Backup is too large (maximum 2 MB).');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { fail(400, 'Invalid JSON.'); }
}
function token(req) { return /(?:^|;\s*)launchpad_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
const tokenHash = value => crypto.createHash('sha256').update(value || '').digest('hex');
function user(req) {
  const t = tokenHash(token(req));
  const session = db.prepare('SELECT user_id, expires FROM sessions WHERE token_hash = ?').get(t);
  if (!session) return null;
  if (session.expires < Date.now()) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(t); return null; }
  const account = db.prepare('SELECT id, email, registration_profile FROM users WHERE id = ?').get(session.user_id);
  return account ? { id: account.id, email: account.email, profile: JSON.parse(account.registration_profile) } : null;
}
function cookie(value, maxAge = 604800) {
  return `launchpad_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`;
}
function validateState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  for (const key of ['applications', 'interviews', 'events', 'opportunities', 'expenses', 'bills']) {
    if (!Array.isArray(data[key]) || data[key].length > 10000 || data[key].some(x => !x || typeof x !== 'object' || Array.isArray(x))) return false;
  }
  return typeof data.profile?.name === 'string' && !profileFields.validate(data.profile) && Array.isArray(data.profile?.interests) && data.profile.interests.every(x => typeof x === 'string') &&
    Array.isArray(data.profile?.roles) && data.profile.roles.every(x => typeof x === 'string') && data.budget && typeof data.budget === 'object' &&
    data.daily && Array.isArray(data.daily.done) && data.history && typeof data.history === 'object';
}
async function remoteJobs() {
  if (jobsCache && Date.now() - jobsCache.time < 6 * 3600000) return jobsCache;
  if (!jobsPending) jobsPending = (async () => {
    const response = await fetch('https://remotive.com/api/remote-jobs', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) fail(502, 'Remotive is unavailable. Try again later.');
    const data = await response.json();
    if (!Array.isArray(data.jobs)) fail(502, 'The job provider returned an unexpected response.');
    jobsCache = { time: Date.now(), jobs: data.jobs.map(j => ({
      id: `remotive-${j.id}`, title: String(j.title || ''), company: String(j.company_name || ''),
      type: String(j.job_type || '').replaceAll('_', ' '), location: String(j.candidate_required_location || 'Remote'),
      tags: (j.tags || []).filter(t => typeof t === 'string'), link: String(j.url || ''), source: 'Remotive',
      description: String(j.category || 'Remote opportunity'), salary: String(j.salary || ''), published: String(j.publication_date || ''),
    })).filter(j => j.link.startsWith('https://remotive.com/')) };
    return jobsCache;
  })().finally(() => { jobsPending = null; });
  return jobsPending;
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
      if (!allowedHosts.has(req.headers.host)) fail(403, 'Unrecognized host.');
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin)) fail(403, 'Cross-origin request blocked.');
        if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Cross-origin request blocked.');
      }
      const account = user(req);
      if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, {
        account, storage: 'Local SQLite database', remotive: true, usajobs: Boolean(process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL),
      });
      if (req.method === 'POST' && ['/api/register', '/api/login'].includes(url.pathname)) {
        const input = await body(req);
        const email = String(input.email || '').trim().toLowerCase();
        const password = input.password;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, 'Use a valid email and a password with 10–128 characters.');
        const key = req.socket.remoteAddress;
        const limit = attempts.get(key) || { count: 0, reset: Date.now() + 900000 };
        if (limit.reset < Date.now()) { limit.count = 0; limit.reset = Date.now() + 900000; }
        if (++limit.count > 20) fail(429, 'Too many attempts. Try again in 15 minutes.');
        attempts.set(key, limit);
        let record = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        const salt = record?.salt || crypto.randomBytes(16).toString('hex');
        const hash = await scrypt(password, salt, 64);
        if (url.pathname === '/api/register') {
          const profile = { name: typeof input.firstName === 'string' ? input.firstName.trim() : '', lastName: typeof input.lastName === 'string' ? input.lastName.trim() : '', dateOfBirth: input.dateOfBirth || '' };
          const profileError = profileFields.validate(profile, true);
          if (profileError) fail(400, profileError);
          if (record) fail(409, 'An account with that email already exists. Sign in instead.');
          record = { id: crypto.randomUUID(), email, profile };
          db.prepare('INSERT INTO users (id,email,salt,hash,registration_profile) VALUES (?,?,?,?,?)').run(record.id, email, salt, hash.toString('hex'), JSON.stringify(profile));
        } else if (!record || !crypto.timingSafeEqual(hash, Buffer.from(record.hash, 'hex'))) fail(401, 'Email or password is incorrect.');
        db.prepare('DELETE FROM sessions WHERE expires < ? OR token_hash = ?').run(Date.now(), tokenHash(token(req)));
        const t = crypto.randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)').run(tokenHash(t), record.id, Date.now() + 604800000);
        return json(res, 200, { account: { id: record.id, email, profile: record.profile || JSON.parse(record.registration_profile || '{}') } }, { 'Set-Cookie': cookie(t) });
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        await body(req); db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token(req)));
        return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
      }
      if (url.pathname === '/api/state' && ['GET', 'PUT'].includes(req.method)) {
        if (!account) fail(401, 'Sign in to save your dashboard to the server.');
        const saved = db.prepare('SELECT body, revision FROM dashboards WHERE user_id = ?').get(account.id);
        if (req.method === 'GET') return json(res, 200, { state: saved ? JSON.parse(saved.body) : null, revision: saved?.revision || 0 });
        const input = await body(req);
        if (input.accountId !== account.id) fail(409, 'The signed-in account changed in another tab. Reload Connections before saving.');
        if (!validateState(input.state)) fail(400, 'The dashboard data is invalid.');
        if (input.revision !== (saved?.revision || 0)) fail(409, 'This dashboard changed in another tab. Export your browser copy, then reload the saved version.');
        const revision = (saved?.revision || 0) + 1;
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO dashboards (user_id,body,revision) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET body=excluded.body,revision=excluded.revision').run(account.id, JSON.stringify(input.state), revision);
          const p = input.state.profile;
          db.prepare('UPDATE users SET registration_profile = ? WHERE id = ?').run(JSON.stringify({ name: p.name, lastName: p.lastName || '', dateOfBirth: p.dateOfBirth || '' }), account.id);
          db.exec('COMMIT');
        } catch (err) { db.exec('ROLLBACK'); throw err; }
        return json(res, 200, { revision });
      }
      if (req.method === 'GET' && url.pathname === '/api/jobs') {
        const query = (url.searchParams.get('q') || '').slice(0, 100).toLowerCase();
        const location = (url.searchParams.get('location') || '').slice(0, 100).toLowerCase();
        if (url.searchParams.get('source') === 'usajobs') {
          if (!process.env.USAJOBS_API_KEY || !process.env.USAJOBS_EMAIL) fail(503, 'USAJOBS needs an API key and email in the server .env file.');
          const endpoint = new URL('https://data.usajobs.gov/api/search');
          endpoint.search = new URLSearchParams({ Keyword: query, LocationName: location, ResultsPerPage: '20' });
          const response = await fetch(endpoint, { headers: { 'User-Agent': process.env.USAJOBS_EMAIL, 'Authorization-Key': process.env.USAJOBS_API_KEY }, signal: AbortSignal.timeout(15000) });
          if (!response.ok) fail(502, 'USAJOBS could not complete this search. Check the server credentials or try again later.');
          const data = await response.json();
          return json(res, 200, { jobs: (data.SearchResult?.SearchResultItems || []).map(({ MatchedObjectId, MatchedObjectDescriptor: j }) => ({
            id: `usajobs-${MatchedObjectId}`, title: j.PositionTitle, company: j.OrganizationName, type: 'Federal job',
            location: j.PositionLocationDisplay, link: j.PositionURI, tags: [], source: 'USAJOBS', description: (j.QualificationSummary || '').slice(0, 350),
          })), fetchedAt: new Date().toISOString(), source: 'USAJOBS' });
        }
        const feed = await remoteJobs();
        const terms = query.split(/\s+/).filter(Boolean);
        const jobs = feed.jobs.filter(j => terms.every(term => `${j.title} ${j.company} ${j.tags.join(' ')} ${j.description}`.toLowerCase().includes(term)) && (!location || j.location.toLowerCase().includes(location)));
        return json(res, 200, { jobs: jobs.slice(0, 30), total: jobs.length, fetchedAt: new Date(feed.time).toISOString(), source: 'Remotive' });
      }
      fail(404, 'API endpoint not found.');
    }
    if (!['GET', 'HEAD'].includes(req.method) || !files[url.pathname]) { res.writeHead(404).end('Not found'); return; }
    const file = files[url.pathname];
    res.writeHead(200, { 'Content-Type': `${types[path.extname(file)]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(__dirname, file)));
  } catch (err) {
    if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : 'The server could not complete the request. Please try again.' });
    else res.end();
  }
});
if (require.main === module) server.listen(PORT, HOST, () => console.log(`Student Launchpad running at http://${HOST}:${PORT}`));
module.exports = { server, db, validateState };
