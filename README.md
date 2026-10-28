# Student Launchpad

MGIS 489 in-class project. One web app that combines two student tools:

| Module | What it tracks | What it does for you |
| --- | --- | --- |
| **Career Launch Dashboard** | Job applications, interviews, career events and target roles | Matches opportunities to your interests and recommends a daily career task |
| **Student Budget Companion** | A manually entered budget, meal spending and upcoming expenses | Calculates a daily spending allowance and suggests adjustments when spending runs high |

The two modules feed each other. The Overview page shows today's career task beside today's spending allowance. When your spending runs high, the daily task switches to "Rebalance your spending".

## Features

**Career**
- Applications pipeline (Saved → Applied → Interviewing → Offer / Rejected), with a status you can change inline and filters by status
- Interview tracker with prep reminders up to 2 days before and a thank-you nudge after
- Career events calendar (career fairs, networking nights, workshops)
- Opportunities ranked by a match score: 60% overlap with your interests and skills, 40% fit with your target role titles
- A daily career task picked from your real data: interview prep, event prep, follow-ups on applications older than 7 days, applying to strong matches, then general growth tasks. Includes a streak counter.

**Budget**
- Budget period setup: total amount, start and end dates, optional meal budget
- Spending log with categories, and upcoming expenses you can mark paid
- **Daily allowance** = (budget − spending before today − upcoming bills) ÷ days left, including today
- Pace tracking: projects your spending to the end of the period and rates it On track, Tight or Over pace
- Suggestions: over today's allowance, projected shortfall and how much to cut per day, meal spending ahead of the meal budget, a category taking too large a share, bills due soon
- Spending-by-category breakdown and a meal budget meter

**General**
- Works on phones and laptops
- Individual accounts with automatic server saves, plus Export, Import and Reset on the Profile page
- **Load sample data** fills the app with realistic demo data, for presentations

## Run it

Use Node.js 24 or later. No dependencies or build step are required:

- Run the local server and go to http://localhost:5173:

```bash
node serve.js
```

Open the server URL rather than the HTML file. Sign in or create an account to use the dashboard. Public job search remains available without signing in.

## Connections (first integration milestone)

- **Accounts:** The entry screen offers Sign in and Create account (first and last name, optional date of birth, email, password, confirmation). Returning users sign in with email and password. Registration details are validated and stored on the server immediately. Existing account records migrate automatically without changing credentials. Personal dashboard pages require sign-in; job listings can be browsed publicly. A visible Sign out button locks the dashboard again. Passwords are hashed with scrypt; sessions use HttpOnly, SameSite cookies and hashed tokens persisted in SQLite. Sessions survive server restarts and expire after seven days. The database is in `.data/launchpad.sqlite` and is excluded from Git. Each user receives a separate dashboard. This is a local development service, not a deployed cloud account system; email verification, password recovery and public deployment are future work.
- **Career profile:** Profile includes editable first/last name, optional birthday, phone, city, region, country, professional headline, school, degree, graduation year, professional summary, and LinkedIn, Indeed and portfolio URLs. Use Save profile details to persist edits. Existing dashboards receive empty defaults for new fields. Dates and links are checked in the browser and on the server. Saved profile links are references, not OAuth connections. Date of birth is not needed for job-board syncing. Résumé generation and direct job-board authorization remain future work.
- **Server saves:** Signed-in dashboards save automatically. Each account has separate data; guest data is kept separately. Use “Copy guest dashboard into account” to explicitly migrate it. Conflicting saves from another tab are blocked; export your browser copy before reloading the saved version. Failed saves retain a pending browser backup. Back up `.data/` while the server is stopped, or export individual dashboards.
- **Live remote jobs:** Opportunities searches the [Remotive public API](https://remotive.com/remote-jobs/api). It works without a key or sign-in, attributes each posting to Remotive, links back to the original, and caches the feed for six hours. Provider listings are delayed by 24 hours. Results remain separate from saved opportunities until saved explicitly. Saving a result does not apply for a job. Fictional starter postings are labeled as demo examples.
- **Federal jobs:** Copy `.env.example` to `.env`, set `USAJOBS_API_KEY` and `USAJOBS_EMAIL`, then restart the server. Obtain credentials through the [USAJOBS developer portal](https://developer.usajobs.gov/tutorials/search-jobs). Secrets stay on the server. USAJOBS is marked unconfigured until both values exist; credentials are validated when you search.
- **LinkedIn and Indeed:** Search shortcuts use your submitted role and location. Paste a posting link into a new opportunity/application to track it manually. There is no scraping, automatic application submission, or personal-account sync.
- **Calendar:** Connections downloads an iCalendar `.ics` file with all interviews and career events. Interviews export in UTC based on this computer’s local timezone, last one hour, and include a 30-minute reminder. Career events are all-day. Import the file into Google Calendar, Outlook or Apple Calendar. This is a one-time export; future edits do not sync automatically. Reimport behavior depends on the calendar app.

### Next: direct Google integration

Not implemented or connected yet. A direct integration needs a Google Cloud project, enabled Calendar/Gmail APIs, an OAuth consent screen, a web OAuth client and an exact callback URL. Start with Calendar event access; Gmail read access should be optional and separate. Add server-side OAuth state validation, encrypted refresh-token storage, revoke/disconnect controls, and a review queue for suggested application changes before enabling mailbox access. A public launch can require Google verification. Never place client secrets or tokens in browser JavaScript or commit them to Git.

### Verification

Run `npm test`. Tests use a temporary database and mocked job-provider responses; they cover accounts, isolation, save conflicts, access controls, cached job filtering and calendar format. A real provider check still depends on network availability.

## Files

- `index.html`: page shell, navigation and dialogs
- `styles.css`: cool gray dashboard, navy navigation, cobalt accents and responsive layout
- `app.js`: all app logic (state, matching, daily task, budget math, views)
- `serve.js`: tiny static server for local development
- `integrations.js`: connections, local account saves, live job search and calendar exports
- `profile-fields.js`: shared registration and career-profile field validation
- `.env.example`: optional provider configuration (copy to `.env`; do not commit real credentials)
