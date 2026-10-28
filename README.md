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
- Data is saved in the browser (localStorage), with Export, Import and Reset on the Profile page
- **Load sample data** fills the app with realistic demo data, for presentations

## Run it

No install or build step. Either:

- open `index.html` in a browser, or
- run the local server and go to http://localhost:5173:

```bash
node serve.js
```

## Files

- `index.html`: page shell, navigation and dialogs
- `styles.css`: dark green theme and responsive layout
- `app.js`: all app logic (state, matching, daily task, budget math, views)
- `serve.js`: tiny static server for local development
