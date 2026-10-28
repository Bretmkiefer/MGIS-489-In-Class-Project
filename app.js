'use strict';

/* ============================================================
   Student Launchpad
   Career Launch Dashboard: tracks applications, interviews,
   career events and target roles; matches opportunities to your
   interests; recommends one career task per day.
   Student Budget Companion: tracks a budget, meal spending and
   upcoming expenses; calculates a daily spending allowance and
   suggests adjustments when spending runs high.
   Data is stored in localStorage.
   ============================================================ */

const STORE_KEY = 'career-launch-dashboard:v1';
const STATUSES = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
const STATUS_COLORS = {
  Saved: 'var(--muted)', Applied: 'var(--info)', Interviewing: 'var(--warn)',
  Offer: 'var(--good)', Rejected: 'var(--danger)',
};
const SPEND_CATEGORIES = ['Meals', 'Groceries', 'Transport', 'School', 'Entertainment', 'Rent & bills', 'Personal', 'Other'];
const MEAL_CATEGORIES = ['Meals', 'Groceries'];
const CATEGORY_COLORS = {
  Meals: '#ff5a36', Groceries: '#f5a524', Transport: '#1f78d1', School: '#7b5cfa',
  Entertainment: '#e8499b', 'Rent & bills': '#0f766e', Personal: '#0f8a4b', Other: '#8a8eb0',
};

const SAMPLE_OPPORTUNITIES = [
  { title: 'Business Analyst Intern', company: 'Northwind Traders', type: 'Internship', location: 'Remote',
    tags: ['business analysis', 'data analytics', 'sql', 'excel'],
    description: 'Support the operations team with weekly reporting, dashboards and process documentation.' },
  { title: 'Junior Data Analyst', company: 'Fabrikam Retail', type: 'Full-time', location: 'Chicago, IL',
    tags: ['data analytics', 'sql', 'python', 'tableau'],
    description: 'Turn sales and inventory data into insights for store leadership.' },
  { title: 'IT Project Coordinator', company: 'Contoso Health', type: 'Full-time', location: 'Hybrid',
    tags: ['project management', 'agile', 'healthcare', 'communication'],
    description: 'Keep EHR upgrade projects on schedule and coordinate between clinical and IT teams.' },
  { title: 'Cybersecurity Analyst I', company: 'Tailspin Bank', type: 'Full-time', location: 'Dallas, TX',
    tags: ['cybersecurity', 'risk', 'compliance', 'networking'],
    description: 'Monitor alerts, triage incidents and help maintain security compliance controls.' },
  { title: 'Systems Analyst Intern', company: 'Adventure Works', type: 'Internship', location: 'Denver, CO',
    tags: ['systems analysis', 'requirements', 'erp', 'sql'],
    description: 'Gather requirements and test changes to the company ERP system.' },
  { title: 'Product Operations Associate', company: 'Litware Software', type: 'Full-time', location: 'Remote',
    tags: ['product management', 'analytics', 'saas', 'communication'],
    description: 'Help the product team run launches, track feature adoption and organize customer feedback.' },
  { title: 'ERP Support Specialist', company: 'Wide World Importers', type: 'Full-time', location: 'Atlanta, GA',
    tags: ['erp', 'sap', 'business process', 'support'],
    description: 'Resolve user issues and improve business processes in SAP.' },
  { title: 'Cloud Solutions Intern', company: 'Proseware Cloud', type: 'Internship', location: 'Remote',
    tags: ['cloud', 'aws', 'python', 'networking'],
    description: 'Build small automation projects and document cloud architecture for customers.' },
];

const GENERAL_TASKS = [
  ['Add one new accomplishment to your resume', 'Pick a recent class project or job win and write it as a result-focused bullet with a number in it.'],
  ['Message one alum working in a target role', 'Send a short LinkedIn note asking for 15 minutes to hear how they got started.'],
  ['Research one company on your list', 'Write down three facts you could mention in an interview: a recent win, a product, and a value.'],
  ['Practice your 30-second pitch out loud', 'Who you are, what you are good at, and what role you are looking for. Record it once and listen back.'],
  ['Write one STAR story', 'Pick a common question like "Tell me about a challenge" and outline Situation, Task, Action and Result.'],
  ['Polish your LinkedIn headline and About section', 'Make the headline name the role you want, not just "Student".'],
  ['Find two new opportunities that fit your interests', 'Add them on the Opportunities page so the dashboard can match and track them.'],
  ['Ask a professor or mentor to review your resume', 'Send it with one specific question so the feedback is easy to give.'],
  ['Spend 30 minutes on a skill from a posting you like', 'Pick one tool or skill you keep seeing in job descriptions and do a short tutorial.'],
  ['Check in with someone in your network', 'Send a quick update or thank-you to a past manager, classmate or recruiter.'],
];

const COLLECTIONS = {
  applications: {
    noun: 'application',
    label: item => `${item.role} at ${item.company}`,
    fields: [
      { key: 'company', label: 'Company', required: true },
      { key: 'role', label: 'Role', required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUSES, initial: 'Applied' },
      { key: 'dateApplied', label: 'Date applied', type: 'date', initial: () => todayISO() },
      { key: 'link', label: 'Posting link', type: 'url', hint: 'Starts with https://' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  interviews: {
    noun: 'interview',
    label: item => `${item.type} with ${item.company}`,
    fields: [
      { key: 'company', label: 'Company', required: true },
      { key: 'role', label: 'Role', required: true },
      { key: 'when', label: 'Date and time', type: 'datetime-local', required: true },
      { key: 'type', label: 'Interview type', type: 'select', options: ['Phone screen', 'Video', 'On-site', 'Technical', 'Final round'], initial: 'Video' },
      { key: 'contact', label: 'Interviewer or contact' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  events: {
    noun: 'event',
    label: item => item.name,
    fields: [
      { key: 'name', label: 'Event name', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'type', label: 'Event type', type: 'select', options: ['Career fair', 'Networking', 'Workshop', 'Info session', 'Conference'], initial: 'Career fair' },
      { key: 'location', label: 'Location' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  opportunities: {
    noun: 'opportunity',
    label: item => `${item.title} at ${item.company}`,
    fields: [
      { key: 'title', label: 'Job title', required: true },
      { key: 'company', label: 'Company', required: true },
      { key: 'type', label: 'Type', type: 'select', options: ['Full-time', 'Internship', 'Part-time', 'Contract'], initial: 'Full-time' },
      { key: 'location', label: 'Location' },
      { key: 'tags', label: 'Skills and keywords', type: 'tags', hint: 'Separate with commas, for example: sql, data analytics' },
      { key: 'link', label: 'Posting link', type: 'url', hint: 'Starts with https://' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  expenses: {
    noun: 'expense',
    label: item => `${money(item.amount)} on ${item.note || item.category}`,
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'category', label: 'Category', type: 'select', options: SPEND_CATEGORIES, initial: 'Meals' },
      { key: 'date', label: 'Date', type: 'date', required: true, initial: () => todayISO() },
      { key: 'note', label: 'What was it for' },
    ],
  },
  bills: {
    noun: 'upcoming expense',
    label: item => item.name,
    fields: [
      { key: 'name', label: 'Name', required: true, hint: 'For example: phone bill, rent share, parking pass' },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'due', label: 'Due date', type: 'date', required: true },
      { key: 'category', label: 'Category', type: 'select', options: SPEND_CATEGORIES, initial: 'Rent & bills' },
    ],
  },
  budget: {
    noun: 'budget',
    singleton: true,
    label: () => 'budget',
    fields: [
      { key: 'total', label: 'Total budget for the period', type: 'number', required: true, hint: 'All the money you have to spend between the start and end dates.' },
      { key: 'start', label: 'Start date', type: 'date', required: true, initial: () => todayISO() },
      { key: 'end', label: 'End date', type: 'date', required: true, initial: () => todayISO(addDays(new Date(), 29)) },
      { key: 'meals', label: 'Meal budget', type: 'number', hint: 'The part of your total set aside for meals and groceries.' },
    ],
  },
};

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
};

/* ---------- Helpers ---------- */

const $ = sel => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lower = v => String(v ?? '').toLowerCase();

function todayISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseDay(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysFromToday(iso) {
  return Math.round((parseDay(iso) - parseDay(todayISO())) / 86400000);
}
function relDay(n) {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}
const fmtDate = iso => parseDay(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = v => new Date(v).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDateTime = v => new Date(v).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = n => moneyFmt.format(Number(n) || 0);
const sum = (list, fn = x => x.amount) => list.reduce((t, x) => t + (Number(fn(x)) || 0), 0);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const safeUrl = url => /^https?:\/\//i.test(url || '') ? url : '';

/* ---------- State ---------- */

function defaultState() {
  return {
    profile: { name: '', interests: [], roles: [] },
    applications: [],
    interviews: [],
    events: [],
    opportunities: SAMPLE_OPPORTUNITIES.map(o => ({ id: uid(), ...o })),
    budget: { total: '', start: '', end: '', meals: '' },
    expenses: [],
    bills: [],
    daily: { date: '', skip: 0, done: [] },
    history: {},
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = defaultState();
      return { ...base, ...saved, profile: { ...base.profile, ...saved.profile }, budget: { ...base.budget, ...saved.budget } };
    }
  } catch { /* fall through to a fresh state */ }
  return defaultState();
}

let state = loadState();
let appFilter = 'All';

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    toast('This browser blocked saving, so changes will be lost on reload.');
  }
}

/* ---------- Matching ---------- */

function matchOpportunity(opp) {
  const { interests, roles } = state.profile;
  if (!interests.length && !roles.length) return { score: 0, interests: [], role: null };

  const haystack = lower([opp.title, opp.description, ...(opp.tags || [])].join(' '));
  const hitInterests = interests.filter(i => haystack.includes(lower(i)));
  const interestScore = Math.min(1, hitInterests.length / Math.min(interests.length, 3));

  const title = lower(opp.title);
  let roleScore = 0;
  let hitRole = null;
  for (const role of roles) {
    const words = lower(role).split(/\s+/).filter(w => w.length > 2);
    if (!words.length) continue;
    const s = words.filter(w => title.includes(w)).length / words.length;
    if (s > roleScore) { roleScore = s; hitRole = role; }
  }

  let score;
  if (interests.length && roles.length) score = 0.6 * interestScore + 0.4 * roleScore;
  else score = interests.length ? interestScore : roleScore;

  return { score: Math.round(score * 100), interests: hitInterests, role: roleScore >= 0.5 ? hitRole : null };
}

function rankedOpportunities() {
  return state.opportunities
    .map(o => ({ ...o, match: matchOpportunity(o) }))
    .sort((a, b) => b.match.score - a.match.score || a.title.localeCompare(b.title));
}

function isTracked(opp) {
  return state.applications.some(a => lower(a.company) === lower(opp.company) && lower(a.role) === lower(opp.title));
}

function matchReasons(match) {
  const parts = [];
  if (match.role) parts.push(`fits your target role <b>${esc(match.role)}</b>`);
  if (match.interests.length) parts.push(`matches <b>${match.interests.map(esc).join('</b>, <b>')}</b>`);
  return parts.length ? `${parts.join(' and ')}.` : 'No overlap with your interests or target roles yet.';
}

/* ---------- Budget ---------- */

const hasBudget = () => Number(state.budget.total) > 0 && state.budget.start && state.budget.end;

function budgetSummary() {
  if (!hasBudget()) return null;
  const b = state.budget;
  const total = Number(b.total);
  const today = todayISO();
  const totalDays = daysBetween(b.start, b.end) + 1;
  const elapsed = clamp(daysBetween(b.start, today) + 1, 0, totalDays);
  const daysLeft = clamp(daysBetween(today, b.end) + 1, 0, totalDays);

  const inPeriod = state.expenses.filter(e => e.date >= b.start && e.date <= b.end);
  const spent = sum(inPeriod);
  const spentToday = sum(inPeriod.filter(e => e.date === today));
  const upcoming = state.bills.filter(x => x.due <= b.end).sort((x, y) => x.due.localeCompare(y.due));
  const upcomingTotal = sum(upcoming);

  // Money still free to spend from today on, after setting aside upcoming bills.
  const available = total - (spent - spentToday) - upcomingTotal;
  const allowance = daysLeft > 0 ? Math.max(0, available) / daysLeft : 0;
  const leftToday = allowance - spentToday;
  const tomorrowAllowance = daysLeft > 1 ? Math.max(0, available - spentToday) / (daysLeft - 1) : 0;

  // Day-to-day spending (bills excluded) projected to the end of the period.
  const billSpend = sum(inPeriod.filter(e => e.category === 'Rent & bills'));
  const dailyAvg = elapsed ? (spent - billSpend) / elapsed : 0;
  const projected = spent + dailyAvg * Math.max(0, daysLeft - 1) + upcomingTotal;
  const status = projected > total ? 'over' : projected > total * 0.92 ? 'tight' : 'good';

  const meals = inPeriod.filter(e => MEAL_CATEGORIES.includes(e.category));
  const mealSpent = sum(meals);
  const mealBudget = Number(b.meals) || 0;
  const mealPace = mealBudget && elapsed ? mealSpent / (mealBudget * elapsed / totalDays) : 0;

  const byCategory = SPEND_CATEGORIES
    .map(c => ({ category: c, amount: sum(inPeriod.filter(e => e.category === c)) }))
    .filter(c => c.amount > 0)
    .sort((x, y) => y.amount - x.amount);

  return { total, totalDays, elapsed, daysLeft, spent, spentToday, upcoming, upcomingTotal, available, allowance,
    leftToday, tomorrowAllowance, dailyAvg, projected, status, meals, mealSpent, mealBudget, mealPace, byCategory, inPeriod };
}

function budgetSuggestions(s) {
  const tips = [];
  if (s.daysLeft === 0) {
    tips.push({ level: 'info', text: 'This budget period has ended. Set up your next period to keep getting a daily allowance.' });
    return tips;
  }
  if (s.available < 0) {
    tips.push({ level: 'bad', text: `Your upcoming expenses are ${money(-s.available)} more than what is left in your budget. Pause non-essential spending and look for a bill you can move or reduce.` });
  }
  if (s.leftToday < 0) {
    tips.push({ level: 'bad', text: `You are ${money(-s.leftToday)} over today's allowance. If you stop here, tomorrow's allowance drops to ${money(s.tomorrowAllowance)}.` });
  }
  if (s.status === 'over' && s.available >= 0) {
    const shortfall = s.projected - s.total;
    tips.push({ level: 'bad', text: `At your current pace you will run ${money(shortfall)} short by ${fmtDate(state.budget.end)}. Spending ${money(shortfall / s.daysLeft)} less per day keeps you on budget.` });
  } else if (s.status === 'tight') {
    tips.push({ level: 'warn', text: `You are on track, but with little room to spare. Keep day-to-day spending under ${money(s.allowance)} to finish with money left.` });
  }
  if (s.mealBudget && s.mealPace > 1.1) {
    const avgMeal = s.mealSpent / s.meals.length;
    const ahead = s.mealSpent - s.mealBudget * s.elapsed / s.totalDays;
    tips.push({ level: 'warn', text: `Meal spending is ${money(ahead)} ahead of your meal budget. Your average food purchase is ${money(avgMeal)}. Cooking or meal-prepping 4 meals this week would save about ${money(avgMeal * 4 * 0.6)}.` });
  }
  const flexible = s.byCategory.filter(c => !['Rent & bills', 'School'].includes(c.category));
  const top = flexible[0];
  if (top && s.spent && top.amount / s.spent > 0.3 && s.status !== 'good') {
    tips.push({ level: 'warn', text: `${top.category} is ${Math.round(top.amount / s.spent * 100)}% of your spending. Trimming it by a quarter frees up ${money(top.amount / 4)}.` });
  }
  const soon = s.upcoming.find(x => daysFromToday(x.due) >= 0 && daysFromToday(x.due) <= 7);
  if (soon) {
    tips.push({ level: 'info', text: `${soon.name} (${money(soon.amount)}) is due ${relDay(daysFromToday(soon.due)).toLowerCase()}. It is already set aside in your allowance.` });
  }
  if (!tips.some(t => t.level !== 'info')) {
    const spare = s.total - s.projected;
    tips.unshift({ level: 'good', text: spare > 0
      ? `Nice work. At this pace you will finish with about ${money(spare)} left. Consider moving ${money(spare / 2)} to savings.`
      : 'You are spending right on budget. Keep it up.' });
  }
  return tips;
}

const STATUS_LABELS = { good: 'On track', tight: 'Tight', over: 'Over pace' };

/* ---------- Daily task ---------- */

function dailyState() {
  const today = todayISO();
  if (state.daily.date !== today) state.daily = { date: today, skip: 0, done: [] };
  return state.daily;
}

function taskCandidates() {
  const daily = dailyState();
  const now = Date.now();
  const tasks = [];
  const { interests, roles } = state.profile;

  if (!interests.length || !roles.length) {
    tasks.push({ id: 'profile', kind: 'Setup', title: 'Add your interests and target roles',
      detail: 'Opportunity matching and your daily task get sharper once the dashboard knows what you are aiming for.',
      link: { label: 'Open profile', href: '#profile' } });
  }

  const budget = budgetSummary();
  if (budget && budget.daysLeft && (budget.status === 'over' || budget.leftToday < 0 || budget.available < 0)) {
    tasks.push({ id: 'budget-rebalance', kind: 'Budget', title: 'Rebalance your spending',
      detail: budgetSuggestions(budget).find(t => t.level === 'bad' || t.level === 'warn')?.text || 'Review your spending and plan the rest of the period.',
      link: { label: 'Open budget', href: '#budget' } });
  }

  const interviews = [...state.interviews].sort((a, b) => new Date(a.when) - new Date(b.when));
  for (const iv of interviews) {
    const n = daysFromToday(iv.when);
    if (new Date(iv.when).getTime() > now && n <= 2) {
      tasks.push({ id: `prep-${iv.id}`, kind: 'Interview prep',
        title: `Prepare for your ${lower(iv.type)} with ${iv.company}`,
        detail: `${relDay(n)} at ${fmtTime(iv.when)}. Reread the ${iv.role} posting, research the company, and rehearse three STAR stories.` });
    }
  }
  for (const iv of interviews) {
    const n = daysFromToday(iv.when);
    if (new Date(iv.when).getTime() <= now && n >= -2) {
      tasks.push({ id: `thanks-${iv.id}`, kind: 'Follow-up',
        title: `Send a thank-you note to ${iv.company}`,
        detail: `Your ${lower(iv.type)} for ${iv.role} was ${lower(relDay(n))}. Thank ${iv.contact || 'your interviewer'} and mention one thing you discussed.` });
    }
  }

  for (const ev of [...state.events].sort((a, b) => a.date.localeCompare(b.date))) {
    const n = daysFromToday(ev.date);
    if (n >= 0 && n <= 3) {
      tasks.push({ id: `event-${ev.id}`, kind: 'Event prep', title: `Get ready for ${ev.name}`,
        detail: `${relDay(n)}${ev.location ? ` at ${ev.location}` : ''}. Pick three employers to talk to, print resumes, and practice your 30-second pitch.` });
    }
  }

  for (const app of state.applications) {
    if (app.status !== 'Applied' || !app.dateApplied) continue;
    const n = daysFromToday(app.dateApplied);
    if (n <= -7) {
      tasks.push({ id: `follow-${app.id}`, kind: 'Follow-up',
        title: `Follow up on your ${app.role} application at ${app.company}`,
        detail: `You applied ${-n} days ago. Send a short, friendly check-in to the recruiter or hiring manager.` });
    }
  }

  for (const opp of rankedOpportunities().filter(o => o.match.score >= 50 && !isTracked(o)).slice(0, 2)) {
    tasks.push({ id: `apply-${opp.id}`, kind: 'Apply',
      title: `Apply to ${opp.title} at ${opp.company}`,
      detail: `It is a ${opp.match.score}% match with your profile. Tailor your resume to its keywords before you submit.`,
      link: { label: 'View opportunities', href: '#opportunities' } });
  }

  const dayOfYear = Math.floor((parseDay(todayISO()) - new Date(new Date().getFullYear(), 0, 1)) / 86400000);
  const offset = dayOfYear % GENERAL_TASKS.length;
  [...GENERAL_TASKS.slice(offset), ...GENERAL_TASKS.slice(0, offset)].forEach(([title, detail], i) => {
    tasks.push({ id: `general-${(offset + i) % GENERAL_TASKS.length}`, kind: 'Career growth', title, detail });
  });

  return tasks.filter(t => !daily.done.includes(t.id));
}

function currentTask() {
  const tasks = taskCandidates();
  return tasks.length ? tasks[state.daily.skip % tasks.length] : null;
}

function streak() {
  const d = new Date();
  if (!state.history[todayISO(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (state.history[todayISO(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- Views ---------- */

function emptyState(title, body, coll) {
  return `<div class="empty"><h3>${title}</h3><p>${body}</p>
    ${coll ? `<button class="btn primary" data-action="add" data-coll="${coll}">${ICONS.plus}Add ${COLLECTIONS[coll].noun}</button>` : ''}</div>`;
}

function pageHead(title, subtitle, coll) {
  return `<div class="page-head"><div><h1>${title}</h1><p class="muted">${subtitle}</p></div>
    ${coll ? `<button class="btn primary" data-action="add" data-coll="${coll}">${ICONS.plus}Add ${COLLECTIONS[coll].noun}</button>` : ''}</div>`;
}

function rowActions(coll, item) {
  const name = esc(COLLECTIONS[coll].label(item));
  return `<button class="btn icon-btn" data-action="edit" data-coll="${coll}" data-id="${item.id}" aria-label="Edit ${name}" title="Edit">${ICONS.edit}</button>
    <button class="btn icon-btn del" data-action="delete" data-coll="${coll}" data-id="${item.id}" aria-label="Delete ${name}" title="Delete">${ICONS.trash}</button>`;
}

function table(coll, rows, columns, rowClass = () => '') {
  return `<div class="table-wrap"><table>
    <thead><tr>${columns.map(c => `<th scope="col">${c.label}</th>`).join('')}<th><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${rows.map(r => `<tr class="${rowClass(r)}">${columns.map(c => `<td data-label="${c.label}"><div>${c.render(r)}</div></td>`).join('')}
      <td class="row-actions">${rowActions(coll, r)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function renderOverview() {
  const dailyDone = dailyState().done.length;
  const task = currentTask();
  const name = state.profile.name.trim();
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${name ? `, ${esc(name)}` : ''}`;

  const apps = state.applications;
  const active = apps.filter(a => a.status === 'Applied' || a.status === 'Interviewing').length;
  const offers = apps.filter(a => a.status === 'Offer').length;
  const now = new Date();
  const upcomingInterviews = state.interviews.filter(i => new Date(i.when) >= now);
  const upcomingEvents = state.events.filter(e => daysFromToday(e.date) >= 0);
  const nextInterview = [...upcomingInterviews].sort((a, b) => new Date(a.when) - new Date(b.when))[0];
  const nextEvent = [...upcomingEvents].sort((a, b) => a.date.localeCompare(b.date))[0];

  const taskHTML = task ? `
    <section class="task-card" aria-labelledby="task-title">
      <p class="eyebrow">Today's career task · <span class="pill accent">${esc(task.kind)}</span></p>
      <h2 id="task-title">${esc(task.title)}</h2>
      <p class="detail">${esc(task.detail)}</p>
      <div class="task-actions">
        <button class="btn primary" data-action="task-done" data-id="${esc(task.id)}">Mark as done</button>
        <button class="btn ghost" data-action="task-skip">Suggest another</button>
        ${task.link ? `<a class="btn ghost" href="${task.link.href}">${task.link.label}</a>` : ''}
      </div>
      <p class="task-foot">${plural(dailyDone, 'task')} done today · ${plural(streak(), 'day')} streak</p>
    </section>` : `
    <section class="task-card"><p class="eyebrow">Today's career task</p><h2>You cleared every task for today</h2>
      <p class="detail">Come back tomorrow for a new recommendation.</p></section>`;

  const counts = STATUSES.map(s => [s, apps.filter(a => a.status === s).length]);
  const pipeline = apps.length ? `
    <div class="pipeline-bar" role="img" aria-label="${counts.map(([s, n]) => `${s} ${n}`).join(', ')}">
      ${counts.filter(([, n]) => n).map(([s, n]) => `<span style="flex:${n};background:${STATUS_COLORS[s]}"></span>`).join('')}
    </div>
    <ul class="legend">${counts.map(([s, n]) => `<li><span class="dot" style="background:${STATUS_COLORS[s]}"></span>${s}<span class="count">${n}</span></li>`).join('')}</ul>`
    : `<div class="empty compact"><p>No applications yet. Track one to see your pipeline.</p>
       <button class="btn" data-action="add" data-coll="applications">${ICONS.plus}Add application</button></div>`;

  const agendaItems = [
    ...upcomingInterviews.map(i => ({ day: i.when.slice(0, 10), title: `${i.type} · ${i.company}`, sub: `${i.role} · ${fmtTime(i.when)}`, kind: 'Interview' })),
    ...upcomingEvents.map(e => ({ day: e.date, title: e.name, sub: [e.type, e.location].filter(Boolean).join(' · '), kind: 'Event' })),
  ].sort((a, b) => a.day.localeCompare(b.day)).slice(0, 5);

  const agenda = agendaItems.length ? `<ul class="agenda">${agendaItems.map(a => {
    const d = parseDay(a.day);
    return `<li><div class="date-chip"><small>${d.toLocaleDateString(undefined, { month: 'short' })}</small><b>${d.getDate()}</b></div>
      <div><div class="title">${esc(a.title)}</div><div class="sub">${esc(a.sub)} · ${relDay(daysFromToday(a.day))}</div></div>
      <span class="pill">${a.kind}</span></li>`;
  }).join('')}</ul>` : `<div class="empty compact"><p>Nothing scheduled. Add an interview or a career event.</p></div>`;

  const matches = rankedOpportunities().slice(0, 3);

  const s = budgetSummary();
  const budgetHTML = s ? `
    <section class="panel budget-mini" aria-labelledby="budget-mini-title">
      <div class="panel-head"><p class="eyebrow" id="budget-mini-title">Spending allowance today</p><span class="pill b-${s.status}">${STATUS_LABELS[s.status]}</span></div>
      <div class="big-money">${money(s.allowance)}</div>
      <p class="${s.leftToday < 0 ? 'neg' : 'muted'}">${s.leftToday < 0 ? `${money(-s.leftToday)} over today` : `${money(s.leftToday)} left to spend today`}</p>
      <div class="meter" aria-hidden="true"><span style="width:${clamp(s.spent / s.total * 100, 0, 100)}%"></span></div>
      <p class="sub muted">${money(s.spent)} of ${money(s.total)} spent · ${plural(s.daysLeft, 'day')} left</p>
      <div class="task-actions">
        <button class="btn primary" data-action="add" data-coll="expenses">${ICONS.plus}Log expense</button>
        <a class="btn ghost" href="#budget">Budget</a>
      </div>
    </section>` : `
    <section class="panel budget-mini">
      <p class="eyebrow">Student Budget Companion</p>
      <h2 style="margin:8px 0 6px">Know what you can spend each day</h2>
      <p class="muted">Enter your budget and upcoming bills to get a daily spending allowance.</p>
      <div class="task-actions"><button class="btn primary" data-action="add" data-coll="budget">Set up budget</button></div>
    </section>`;

  const isEmpty = !apps.length && !state.interviews.length && !state.events.length && !state.expenses.length && !hasBudget();

  return `
    <div class="page-head"><div>
      <p class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <h1>${greeting}</h1></div>
      ${isEmpty ? '<button class="btn" data-action="sample">Load sample data</button>' : ''}</div>
    <div class="stack">
      <div class="hero">${taskHTML}${budgetHTML}</div>
      <div class="stats">
        <div class="panel stat"><div class="label">Applications</div><div class="value">${apps.length}</div><div class="sub">${offers ? plural(offers, 'offer') : 'No offers yet'}</div></div>
        <div class="panel stat"><div class="label">Active pipeline</div><div class="value">${active}</div><div class="sub">Applied or interviewing</div></div>
        <div class="panel stat"><div class="label">Upcoming interviews</div><div class="value">${upcomingInterviews.length}</div><div class="sub">${nextInterview ? `Next: ${esc(nextInterview.company)}, ${relDay(daysFromToday(nextInterview.when)).toLowerCase()}` : 'None scheduled'}</div></div>
        <div class="panel stat"><div class="label">Career events</div><div class="value">${upcomingEvents.length}</div><div class="sub">${nextEvent ? `Next: ${relDay(daysFromToday(nextEvent.date)).toLowerCase()}` : 'None scheduled'}</div></div>
      </div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h2>Application pipeline</h2><a href="#applications">View all</a></div>${pipeline}</section>
        <section class="panel"><div class="panel-head"><h2>Coming up</h2><a href="#interviews">Interviews</a></div>${agenda}</section>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>Top matches for you</h2><a href="#opportunities">All opportunities</a></div>
        ${state.profile.interests.length || state.profile.roles.length
          ? `<div class="cards">${matches.map(oppCard).join('')}</div>`
          : `<div class="empty compact"><p>Add your interests and target roles to see which opportunities fit you best.</p><a class="btn" href="#profile">Set up profile</a></div>`}
      </section>
    </div>`;
}

function renderApplications() {
  const rows = state.applications
    .filter(a => appFilter === 'All' || a.status === appFilter)
    .sort((a, b) => (b.dateApplied || '').localeCompare(a.dateApplied || ''));
  const filters = ['All', ...STATUSES].map(s => {
    const n = s === 'All' ? state.applications.length : state.applications.filter(a => a.status === s).length;
    return `<button class="filter" data-action="filter" data-status="${s}" aria-pressed="${appFilter === s}">${s} · ${n}</button>`;
  }).join('');

  let body;
  if (!state.applications.length) body = emptyState('No applications yet', 'Track every job you apply to so you know when to follow up.', 'applications');
  else if (!rows.length) body = `<div class="empty"><h3>No ${appFilter.toLowerCase()} applications</h3><p>Try a different status filter.</p><button class="btn" data-action="filter" data-status="All">Show all</button></div>`;
  else body = table('applications', rows, [
    { label: 'Role', render: a => `<strong>${esc(a.role)}</strong><span class="sub">${esc(a.company)}</span>` },
    { label: 'Status', render: a => `<select class="status-select" data-action="set-status" data-id="${a.id}" aria-label="Status for ${esc(a.role)} at ${esc(a.company)}">${STATUSES.map(s => `<option${s === a.status ? ' selected' : ''}>${s}</option>`).join('')}</select>` },
    { label: 'Applied', render: a => a.dateApplied ? `${fmtDate(a.dateApplied)}<span class="sub">${relDay(daysFromToday(a.dateApplied))}</span>` : '<span class="muted">Not yet</span>' },
    { label: 'Notes', render: a => `<div class="notes">${esc(a.notes) || '—'}</div>` },
    { label: 'Link', render: a => safeUrl(a.link) ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">Posting</a>` : '<span class="muted">—</span>' },
  ]);

  return `${pageHead('Applications', 'Every job you have saved or applied to, and where it stands.', 'applications')}
    ${state.applications.length ? `<div class="filters" role="group" aria-label="Filter by status">${filters}</div>` : ''}${body}`;
}

function renderInterviews() {
  const now = new Date();
  const upcoming = state.interviews.filter(i => new Date(i.when) >= now).sort((a, b) => new Date(a.when) - new Date(b.when));
  const past = state.interviews.filter(i => new Date(i.when) < now).sort((a, b) => new Date(b.when) - new Date(a.when));
  const columns = [
    { label: 'When', render: i => `${fmtDateTime(i.when)}<span class="sub">${relDay(daysFromToday(i.when))}</span>` },
    { label: 'Company', render: i => `<strong>${esc(i.company)}</strong><span class="sub">${esc(i.role)}</span>` },
    { label: 'Type', render: i => `<span class="pill">${esc(i.type)}</span>` },
    { label: 'Contact', render: i => esc(i.contact) || '<span class="muted">—</span>' },
    { label: 'Notes', render: i => `<div class="notes">${esc(i.notes) || '—'}</div>` },
  ];
  const body = state.interviews.length
    ? table('interviews', [...upcoming, ...past], columns, i => new Date(i.when) < now ? 'is-past' : '')
    : emptyState('No interviews scheduled', 'Add interviews to get prep reminders the day before and a thank-you nudge after.', 'interviews');
  return `${pageHead('Interviews', `${plural(upcoming.length, 'upcoming interview')}, ${past.length} past.`, 'interviews')}${body}`;
}

function renderEvents() {
  const upcoming = state.events.filter(e => daysFromToday(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const past = state.events.filter(e => daysFromToday(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
  const columns = [
    { label: 'Date', render: e => `${fmtDate(e.date)}<span class="sub">${relDay(daysFromToday(e.date))}</span>` },
    { label: 'Event', render: e => `<strong>${esc(e.name)}</strong>` },
    { label: 'Type', render: e => `<span class="pill">${esc(e.type)}</span>` },
    { label: 'Location', render: e => esc(e.location) || '<span class="muted">—</span>' },
    { label: 'Notes', render: e => `<div class="notes">${esc(e.notes) || '—'}</div>` },
  ];
  const body = state.events.length
    ? table('events', [...upcoming, ...past], columns, e => daysFromToday(e.date) < 0 ? 'is-past' : '')
    : emptyState('No career events yet', 'Add career fairs, networking nights and workshops so you never miss one.', 'events');
  return `${pageHead('Career events', `${plural(upcoming.length, 'upcoming event')}.`, 'events')}${body}`;
}

function oppCard(o) {
  const tracked = isTracked(o);
  const hits = new Set(o.match.interests.map(lower));
  const name = esc(`${o.title} at ${o.company}`);
  return `<article class="panel opp">
    <div class="opp-top">
      <div><h3>${esc(o.title)}</h3><div class="sub">${esc(o.company)} · ${esc([o.type, o.location].filter(Boolean).join(' · '))}</div></div>
      <div class="score" style="--p:${o.match.score}" title="Match score"><span>${o.match.score}%</span></div>
    </div>
    ${o.description ? `<p class="sub">${esc(o.description)}</p>` : ''}
    <p class="reasons">${matchReasons(o.match)}</p>
    ${o.tags?.length ? `<div class="tags">${o.tags.map(t => `<span class="tag${[...hits].some(h => lower(t).includes(h)) ? ' hit' : ''}">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="opp-actions">
      <button class="btn${tracked ? '' : ' primary'}" data-action="track" data-id="${o.id}" ${tracked ? 'disabled' : ''}>${tracked ? 'Tracked' : 'Track application'}</button>
      ${safeUrl(o.link) ? `<a class="btn icon-btn" href="${esc(o.link)}" target="_blank" rel="noopener" aria-label="Open posting for ${name}" title="Open posting">${ICONS.link}</a>` : ''}
      ${rowActions('opportunities', o)}
    </div>
  </article>`;
}

function renderOpportunities() {
  const ranked = rankedOpportunities();
  const hasProfile = state.profile.interests.length || state.profile.roles.length;
  return `${pageHead('Opportunities', hasProfile
      ? 'Ranked by how well each one matches your interests and target roles.'
      : 'Add interests and target roles on your <a href="#profile">profile</a> to rank these by fit.', 'opportunities')}
    ${ranked.length ? `<div class="cards">${ranked.map(oppCard).join('')}</div>`
      : emptyState('No opportunities saved', 'Add job postings you find so the dashboard can score them against your interests.', 'opportunities')}`;
}

function tagEditor(list, label, placeholder, suggestions) {
  const values = state.profile[list];
  return `<section class="panel">
    <div class="panel-head"><h2>${label}</h2><span class="muted">${values.length}</span></div>
    ${values.length ? `<ul class="chips">${values.map(v => `<li class="chip">${esc(v)}<button data-action="tag-remove" data-list="${list}" data-value="${esc(v)}" aria-label="Remove ${esc(v)}" title="Remove">×</button></li>`).join('')}</ul>` : ''}
    <div class="inline-add">
      <label for="${list}-input" class="sr-only">Add to ${label}</label>
      <input id="${list}-input" data-tag-input="${list}" placeholder="${placeholder}" autocomplete="off">
      <button class="btn" data-action="tag-add" data-list="${list}">Add</button>
    </div>
    ${suggestions.length ? `<div class="suggest"><span class="label">Suggestions:</span>${suggestions.map(s => `<button data-action="tag-suggest" data-list="${list}" data-value="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>` : ''}
  </section>`;
}

function renderProfile() {
  const p = state.profile;
  const taken = list => new Set(p[list].map(lower));
  const tagCounts = {};
  state.opportunities.forEach(o => (o.tags || []).forEach(t => { tagCounts[lower(t)] = (tagCounts[lower(t)] || 0) + 1; }));
  const interestSuggestions = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]).filter(t => !taken('interests').has(t)).slice(0, 8);
  const roleSuggestions = [...new Set(state.opportunities.map(o => o.title))].filter(t => !taken('roles').has(lower(t))).slice(0, 5);

  return `${pageHead('Profile', 'What you are aiming for. This drives opportunity matching and your daily task.')}
    <div class="stack">
      <section class="panel field">
        <label for="profile-name">Your first name <span class="optional">(optional)</span></label>
        <input id="profile-name" data-action="profile-name" value="${esc(p.name)}" autocomplete="given-name">
      </section>
      <div class="grid-2">
        ${tagEditor('interests', 'Interests and skills', 'e.g. data analytics', interestSuggestions)}
        ${tagEditor('roles', 'Target roles', 'e.g. Business Analyst', roleSuggestions)}
      </div>
      <section class="panel">
        <h2>Your data</h2>
        <p class="muted" style="margin-top:4px">Everything is saved in this browser only. Export a backup to move it to another computer.</p>
        <div class="data-actions">
          <button class="btn" data-action="export">Export backup</button>
          <button class="btn" data-action="import">Import backup</button>
          <button class="btn" data-action="sample">Load sample data</button>
          <button class="btn ghost" data-action="reset">Reset all data</button>
        </div>
      </section>
    </div>`;
}

function renderBudget() {
  const s = budgetSummary();
  if (!s) {
    return `${pageHead('Budget', 'Student Budget Companion: a daily allowance that keeps you on budget.')}
      <div class="empty"><h3>Set up your budget</h3>
        <p>Enter how much money you have for a period, like a month or a semester. Add meals and upcoming bills, and you'll get a daily spending allowance plus tips when spending runs high.</p>
        <button class="btn primary" data-action="add" data-coll="budget">Set up budget</button></div>`;
  }

  const b = state.budget;
  const spentPct = clamp(s.spent / s.total * 100, 0, 100);
  const upcomingPct = clamp(s.upcomingTotal / s.total * 100, 0, 100 - spentPct);
  const pacePct = clamp(s.elapsed / s.totalDays * 100, 0, 100);
  const tips = budgetSuggestions(s);
  const maxCat = s.byCategory[0]?.amount || 1;

  const expenses = [...state.expenses].sort((x, y) => y.date.localeCompare(x.date));
  const bills = [...state.bills].sort((x, y) => x.due.localeCompare(y.due));

  return `
    <div class="page-head">
      <div><h1>Budget</h1><p class="muted">${fmtDate(b.start)} – ${fmtDate(b.end)} · ${plural(s.daysLeft, 'day')} left</p></div>
      <div class="head-actions">
        <button class="btn ghost" data-action="add" data-coll="budget">${ICONS.edit}Edit budget</button>
        <button class="btn" data-action="add" data-coll="bills">${ICONS.plus}Upcoming expense</button>
        <button class="btn primary" data-action="add" data-coll="expenses">${ICONS.plus}Log expense</button>
      </div>
    </div>
    <div class="stack">
      <section class="panel budget-hero">
        <div>
          <p class="eyebrow">Daily spending allowance</p>
          <div class="big-money xl">${money(s.allowance)}</div>
          <p class="${s.leftToday < 0 ? 'neg' : 'muted'}">${s.leftToday < 0 ? `${money(-s.leftToday)} over today's allowance` : `${money(s.leftToday)} left to spend today`} · <span class="pill b-${s.status}">${STATUS_LABELS[s.status]}</span></p>
        </div>
        <div class="budget-progress">
          <div class="progress-labels"><span>Spent <b>${money(s.spent)}</b></span><span>Budget <b>${money(s.total)}</b></span></div>
          <div class="progress" role="img" aria-label="${money(s.spent)} spent and ${money(s.upcomingTotal)} set aside of ${money(s.total)}; ${Math.round(pacePct)}% of the period has passed">
            <span class="fill" style="width:${spentPct}%"></span>
            <span class="reserved" style="width:${upcomingPct}%"></span>
            <i class="pace" style="left:${pacePct}%"></i>
          </div>
          <ul class="legend inline">
            <li><span class="dot" style="background:var(--accent)"></span>Spent</li>
            <li><span class="dot" style="background:var(--warn)"></span>Set aside for bills</li>
            <li><span class="pace-key"></span>Today in the period</li>
          </ul>
        </div>
      </section>

      <div class="stats">
        <div class="panel stat"><div class="label">Left in budget</div><div class="value">${money(s.total - s.spent)}</div><div class="sub">${money(Math.max(0, s.available))} free after bills</div></div>
        <div class="panel stat"><div class="label">Upcoming expenses</div><div class="value">${money(s.upcomingTotal)}</div><div class="sub">${plural(s.upcoming.length, 'bill')} before ${fmtDate(b.end).replace(/, \d{4}$/, '')}</div></div>
        <div class="panel stat"><div class="label">Meal spending</div><div class="value">${money(s.mealSpent)}</div><div class="sub">${s.mealBudget ? `of ${money(s.mealBudget)} meal budget` : `${plural(s.meals.length, 'purchase')}`}</div></div>
        <div class="panel stat"><div class="label">Average day</div><div class="value">${money(s.dailyAvg)}</div><div class="sub">Not counting bills</div></div>
      </div>

      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h2>Suggestions</h2></div>
          <ul class="tips">${tips.map(t => `<li class="tip-${t.level}">${esc(t.text)}</li>`).join('')}</ul>
        </section>
        <section class="panel"><div class="panel-head"><h2>Where it's going</h2><span class="muted">${money(s.spent)}</span></div>
          ${s.byCategory.length ? `<ul class="cat-bars">${s.byCategory.map(c => `<li>
            <span class="cat-name">${c.category}</span>
            <span class="cat-track"><span style="width:${c.amount / maxCat * 100}%;background:${CATEGORY_COLORS[c.category]}"></span></span>
            <span class="cat-amt">${money(c.amount)}</span></li>`).join('')}</ul>`
            : '<div class="empty compact"><p>Log an expense to see where your money goes.</p></div>'}
        </section>
      </div>

      ${s.mealBudget ? `<section class="panel">
        <div class="panel-head"><h2>Meal budget</h2><span class="muted">${money(s.mealSpent)} of ${money(s.mealBudget)}</span></div>
        <div class="progress" aria-hidden="true"><span class="fill" style="width:${clamp(s.mealSpent / s.mealBudget * 100, 0, 100)}%;${s.mealPace > 1.1 ? 'background:var(--warn)' : ''}"></span><i class="pace" style="left:${pacePct}%"></i></div>
        <p class="muted sub" style="margin-top:8px">${money(Math.max(0, s.mealBudget - s.mealSpent) / Math.max(1, s.daysLeft))} per day left for food · ${plural(s.meals.length, 'meal purchase')} this period</p>
      </section>` : ''}

      <section>
        <div class="panel-head"><h2>Upcoming expenses</h2></div>
        ${bills.length ? `<div class="table-wrap"><table>
          <thead><tr><th scope="col">Due</th><th scope="col">Expense</th><th scope="col">Amount</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${bills.map(x => `<tr class="${daysFromToday(x.due) < 0 ? 'overdue' : ''}">
            <td data-label="Due"><div>${fmtDate(x.due)}<span class="sub">${relDay(daysFromToday(x.due))}</span></div></td>
            <td data-label="Expense"><div><strong>${esc(x.name)}</strong><span class="sub">${esc(x.category)}</span></div></td>
            <td data-label="Amount"><div>${money(x.amount)}</div></td>
            <td class="row-actions"><button class="btn" data-action="pay" data-id="${x.id}">Mark paid</button>${rowActions('bills', x)}</td></tr>`).join('')}</tbody>
        </table></div>` : emptyState('No upcoming expenses', 'Add rent, phone bills or tuition payments so your allowance sets money aside for them.', 'bills')}
      </section>

      <section>
        <div class="panel-head"><h2>Spending log</h2><span class="muted">${plural(expenses.length, 'expense')}</span></div>
        ${expenses.length ? table('expenses', expenses, [
          { label: 'Date', render: e => `${fmtDate(e.date)}<span class="sub">${relDay(daysFromToday(e.date))}</span>` },
          { label: 'Expense', render: e => `<strong>${esc(e.note || e.category)}</strong>` },
          { label: 'Category', render: e => `<span class="pill"><span class="dot" style="background:${CATEGORY_COLORS[e.category] || 'var(--muted)'}"></span>${esc(e.category)}</span>` },
          { label: 'Amount', render: e => money(e.amount) },
        ]) : emptyState('No spending logged', 'Log meals and purchases as you go. It takes five seconds and keeps your allowance accurate.', 'expenses')}
      </section>
    </div>`;
}

const VIEWS = {
  overview: renderOverview,
  budget: renderBudget,
  applications: renderApplications,
  interviews: renderInterviews,
  events: renderEvents,
  opportunities: renderOpportunities,
  profile: renderProfile,
};

function currentView() {
  const v = location.hash.slice(1);
  return VIEWS[v] ? v : 'overview';
}

function render() {
  const view = currentView();
  $('#app').innerHTML = VIEWS[view]();
  document.querySelectorAll('.tabs a').forEach(a => {
    if (a.getAttribute('href') === `#${view}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${view === 'overview' ? 'Student Launchpad' : `${view[0].toUpperCase()}${view.slice(1)} · Student Launchpad`}`;
}

/* ---------- Form dialog ---------- */

const formDialog = $('#form-dialog');
const entryForm = $('#entry-form');
let formCtx = null;

function fieldHTML(f, item) {
  let v = item ? item[f.key] : (typeof f.initial === 'function' ? f.initial() : f.initial);
  if (f.type === 'tags' && Array.isArray(v)) v = v.join(', ');
  v = v ?? '';
  const id = `f-${f.key}`;
  const describedBy = [f.hint ? `${id}-hint` : '', `${id}-err`].filter(Boolean).join(' ');
  const attrs = `id="${id}" name="${f.key}" aria-describedby="${describedBy}"${f.required ? ' required' : ''}${f.type === 'number' ? ' step="0.01" min="0" inputmode="decimal" placeholder="0.00"' : ''}`;
  let control;
  if (f.type === 'select') control = `<select ${attrs}>${f.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') control = `<textarea ${attrs}>${esc(v)}</textarea>`;
  else control = `<input ${attrs} type="${f.type === 'tags' || !f.type ? 'text' : f.type}" value="${esc(v)}">`;
  return `<div class="field">
    <label for="${id}">${f.label}${f.required ? '' : ' <span class="optional">(optional)</span>'}</label>
    ${control}
    ${f.hint ? `<p class="hint" id="${id}-hint">${f.hint}</p>` : ''}
    <p class="field-error" id="${id}-err" hidden></p>
  </div>`;
}

function openForm(coll, item) {
  const cfg = COLLECTIONS[coll];
  if (cfg.singleton) item = coll === 'budget' && !hasBudget() ? null : state[coll];
  formCtx = { coll, id: item?.id };
  $('#form-title').textContent = cfg.singleton ? (item ? `Edit ${cfg.noun}` : `Set up your ${cfg.noun}`) : `${item ? 'Edit' : 'Add'} ${cfg.noun}`;
  $('#form-submit').textContent = item ? 'Save changes' : cfg.singleton ? `Save ${cfg.noun}` : `Add ${cfg.noun}`;
  $('#form-fields').innerHTML = cfg.fields.map(f => fieldHTML(f, item)).join('');
  formDialog.showModal();
  formDialog.querySelector('input, select, textarea')?.focus();
}

function fieldError(el) {
  const f = COLLECTIONS[formCtx.coll].fields.find(x => x.key === el.name);
  const value = el.value.trim();
  if (f.required && !value) return `Enter the ${f.label.toLowerCase()}.`;
  if (f.type === 'url' && value && !safeUrl(value)) return 'Enter the full link, starting with https://';
  if (f.type === 'number' && value && !(Number(value) >= 0)) return 'Enter an amount like 12.50';
  if (f.type === 'number' && f.required && Number(value) === 0) return `Enter a ${f.label.toLowerCase()} above zero.`;
  if (el.name === 'end' && value && entryForm.elements.start?.value > value) return 'Pick an end date on or after the start date.';
  return '';
}

function showFieldError(el, message) {
  const err = $(`#${el.id}-err`);
  err.textContent = message;
  err.hidden = !message;
  el.setAttribute('aria-invalid', message ? 'true' : 'false');
}

entryForm.addEventListener('focusout', e => {
  if (e.target.name) showFieldError(e.target, fieldError(e.target));
});
entryForm.addEventListener('input', e => {
  if (e.target.getAttribute('aria-invalid') === 'true' && !fieldError(e.target)) showFieldError(e.target, '');
});
$('#form-cancel').addEventListener('click', () => formDialog.close());

entryForm.addEventListener('submit', e => {
  e.preventDefault();
  const cfg = COLLECTIONS[formCtx.coll];
  let firstInvalid = null;
  const data = {};
  for (const f of cfg.fields) {
    const el = entryForm.elements[f.key];
    const message = fieldError(el);
    showFieldError(el, message);
    if (message && !firstInvalid) firstInvalid = el;
    const value = el.value.trim();
    data[f.key] = f.type === 'tags' ? value.split(',').map(t => t.trim()).filter(Boolean)
      : f.type === 'number' ? (value === '' ? '' : Math.round(Number(value) * 100) / 100)
      : value;
  }
  if (firstInvalid) { firstInvalid.focus(); return; }

  if (cfg.singleton) {
    state[formCtx.coll] = data;
  } else {
    const list = state[formCtx.coll];
    if (formCtx.id) Object.assign(list.find(x => x.id === formCtx.id), data);
    else list.push({ id: uid(), ...data });
  }
  save();
  formDialog.close();
  render();
  toast(cfg.singleton ? 'Budget saved' : `${formCtx.id ? 'Saved' : 'Added'} ${cfg.label(data)}`);
});

/* ---------- Confirm + toast ---------- */

const confirmDialog = $('#confirm-dialog');
function confirmAction(title, body, label) {
  return new Promise(resolve => {
    $('#confirm-title').textContent = title;
    $('#confirm-body').textContent = body;
    $('#confirm-ok').textContent = label;
    confirmDialog.returnValue = '';
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'ok'), { once: true });
    confirmDialog.showModal();
  });
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Sample data ---------- */

function loadSampleData() {
  const day = n => todayISO(addDays(new Date(), n));
  const at = (n, time) => `${day(n)}T${time}`;
  const fresh = defaultState();
  fresh.profile = { name: state.profile.name, interests: ['data analytics', 'sql', 'project management'], roles: ['Data Analyst', 'Business Analyst'] };
  fresh.history = state.history;
  fresh.daily = state.daily;
  fresh.applications = [
    { company: 'Fabrikam Retail', role: 'Junior Data Analyst', status: 'Interviewing', dateApplied: day(-12), link: '', notes: 'Referred by a classmate.' },
    { company: 'Northwind Traders', role: 'Business Analyst Intern', status: 'Applied', dateApplied: day(-9), link: '', notes: '' },
    { company: 'Litware Software', role: 'Product Operations Associate', status: 'Applied', dateApplied: day(-3), link: '', notes: 'Applied through the careers portal.' },
    { company: 'Tailspin Bank', role: 'Cybersecurity Analyst I', status: 'Saved', dateApplied: '', link: '', notes: 'Need to update resume first.' },
    { company: 'Contoso Health', role: 'IT Project Coordinator', status: 'Rejected', dateApplied: day(-24), link: '', notes: '' },
  ].map(a => ({ id: uid(), ...a }));
  fresh.interviews = [
    { company: 'Fabrikam Retail', role: 'Junior Data Analyst', when: at(1, '10:00'), type: 'Video', contact: 'Jordan Lee, Analytics Manager', notes: 'Expect a SQL exercise.' },
    { company: 'Contoso Health', role: 'IT Project Coordinator', when: at(-15, '14:30'), type: 'Phone screen', contact: 'Recruiting team', notes: '' },
  ].map(i => ({ id: uid(), ...i }));
  fresh.events = [
    { name: 'Spring Career Fair', date: day(2), type: 'Career fair', location: 'Student Union Ballroom', notes: '60+ employers.' },
    { name: 'Tech Networking Night', date: day(9), type: 'Networking', location: 'Business School Atrium', notes: '' },
    { name: 'Resume Workshop', date: day(16), type: 'Workshop', location: 'Career Center', notes: '' },
  ].map(e => ({ id: uid(), ...e }));

  fresh.budget = { total: 1200, start: day(-14), end: day(16), meals: 400 };
  const meals = [16.5, 12.75, 18.2, 9.5, 21.4, 14.0, 17.85, 11.25, 19.6, 15.3, 22.1, 13.45, 16.9, 18.75];
  const mealNotes = ['Lunch on campus', 'Coffee and bagel', 'Dinner with friends', 'Chipotle', 'Late-night pizza', 'Dining hall', 'Sushi'];
  fresh.expenses = [
    ...meals.map((amount, i) => ({ amount, category: 'Meals', date: day(-13 + i), note: mealNotes[i % mealNotes.length] })),
    { amount: 14.25, category: 'Meals', date: day(0), note: 'Lunch on campus' },
    { amount: 58.4, category: 'Groceries', date: day(-12), note: 'Weekly groceries' },
    { amount: 52.15, category: 'Groceries', date: day(-5), note: 'Weekly groceries' },
    { amount: 40, category: 'Transport', date: day(-10), note: 'Gas' },
    { amount: 85, category: 'School', date: day(-11), note: 'Textbook' },
    { amount: 38, category: 'Entertainment', date: day(-7), note: 'Concert tickets' },
    { amount: 24.99, category: 'Personal', date: day(-4), note: 'Haircut' },
  ].map(e => ({ id: uid(), ...e }));
  fresh.bills = [
    { name: 'Phone bill', amount: 45, due: day(5), category: 'Rent & bills' },
    { name: 'Streaming subscription', amount: 11.99, due: day(10), category: 'Entertainment' },
    { name: 'Rent share', amount: 350, due: day(12), category: 'Rent & bills' },
  ].map(x => ({ id: uid(), ...x }));
  state = fresh;
}

/* ---------- Actions ---------- */

function addTag(list, raw) {
  const value = raw.trim();
  if (!value) return;
  if (state.profile[list].some(v => lower(v) === lower(value))) { toast(`${value} is already on your list`); return; }
  state.profile[list].push(value);
  save();
  render();
  $(`#${list}-input`)?.focus();
}

const actions = {
  add: el => openForm(el.dataset.coll),
  edit: el => openForm(el.dataset.coll, state[el.dataset.coll].find(x => x.id === el.dataset.id)),
  async delete(el) {
    const { coll, id } = el.dataset;
    const item = state[coll].find(x => x.id === id);
    const name = COLLECTIONS[coll].label(item);
    if (!await confirmAction(`Delete ${name}?`, `This removes the ${COLLECTIONS[coll].noun} from your dashboard. You can't undo this.`, `Delete ${COLLECTIONS[coll].noun}`)) return;
    state[coll] = state[coll].filter(x => x.id !== id);
    save();
    render();
    toast(`Deleted ${name}`);
  },
  'task-done': el => {
    const daily = dailyState();
    daily.done.push(el.dataset.id);
    daily.skip = 0;
    state.history[daily.date] = (state.history[daily.date] || 0) + 1;
    save();
    render();
    toast('Task done. Here is your next one.');
  },
  'task-skip': () => {
    dailyState().skip++;
    save();
    render();
  },
  filter: el => { appFilter = el.dataset.status; render(); },
  track: el => {
    const opp = state.opportunities.find(o => o.id === el.dataset.id);
    state.applications.push({ id: uid(), company: opp.company, role: opp.title, status: 'Saved', dateApplied: '', link: opp.link || '', notes: '' });
    save();
    render();
    toast(`Tracking ${opp.title} at ${opp.company} as Saved`);
  },
  'tag-add': el => addTag(el.dataset.list, $(`#${el.dataset.list}-input`).value),
  'tag-suggest': el => addTag(el.dataset.list, el.dataset.value),
  'tag-remove': el => {
    const { list, value } = el.dataset;
    state.profile[list] = state.profile[list].filter(v => v !== value);
    save();
    render();
  },
  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `career-launch-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  pay: el => {
    const bill = state.bills.find(x => x.id === el.dataset.id);
    state.bills = state.bills.filter(x => x.id !== bill.id);
    state.expenses.push({ id: uid(), amount: bill.amount, category: bill.category, date: todayISO(), note: bill.name });
    save();
    render();
    toast(`${bill.name} marked paid and added to your spending log`);
  },
  async sample() {
    const hasData = state.applications.length || state.expenses.length || hasBudget();
    if (hasData && !await confirmAction('Replace your data with sample data?', 'Your current applications, interviews, events, budget and expenses will be replaced. Export a backup first if you want to keep them.', 'Load sample data')) return;
    loadSampleData();
    save();
    render();
    toast('Sample data loaded');
  },
  import: () => $('#import-file').click(),
  async reset() {
    if (!await confirmAction('Reset all data?', 'This deletes every application, interview, event, opportunity and profile setting in this browser. Export a backup first if you might want it back.', 'Reset all data')) return;
    state = defaultState();
    save();
    render();
    toast('All data reset');
  },
};

const app = $('#app');
app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && el.tagName !== 'SELECT' && el.tagName !== 'INPUT' && actions[el.dataset.action]) actions[el.dataset.action](el);
});
app.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.action === 'set-status') {
    const item = state.applications.find(a => a.id === el.dataset.id);
    item.status = el.value;
    if (el.value === 'Applied' && !item.dateApplied) item.dateApplied = todayISO();
    save();
    render();
    toast(`${item.role} at ${item.company} moved to ${item.status}`);
  } else if (el.dataset.action === 'profile-name') {
    state.profile.name = el.value.trim();
    save();
  }
});
app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset.tagInput) {
    e.preventDefault();
    addTag(e.target.dataset.tagInput, e.target.value);
  }
});

$('#import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.applications) || !data.profile) throw new Error('bad shape');
    state = { ...defaultState(), ...data };
    save();
    render();
    toast('Backup imported');
  } catch {
    toast('That file is not a Career Launch backup. Choose a file you exported from this dashboard.');
  }
});

window.addEventListener('hashchange', () => { render(); $('#app').focus({ preventScroll: true }); window.scrollTo(0, 0); });
render();
