---
title: Dashboard
summary: Read the five tiles, the recent enlistments and the count of ratings by rate.
order: 10
module: dashboard
---

The Dashboard is the first page after you sign in. It gives you the main numbers at a glance. Every figure is counted live from the records, so it is always up to date.

## The Dashboard {#dashboard-home-page screen=dashboard.home}

The page has three parts: the five tiles at the top, **Recently Enlisted** and **Current Ratings by Rate**.

![The Dashboard](shot:dashboard-overview)

### Read the Dashboard {#dashboard-read}

1. Open **Dashboard** from the sidebar, or press **Home** at the bottom of a phone.
2. Read the five tiles at the top: **Members**, **Drafting**, **Disciplinary**, **Discharge** and **Appraisals**.
3. Press the small line at the foot of a tile to open the page that line counts. For example, the line under **Disciplinary** opens [Pending Cases](#disciplinary/pending).
4. Read **Recently Enlisted** for the five newest ratings. Press **View All** to open the [Current Ratings](#ratings/current) list.
5. Read **Current Ratings by Rate** for the number of serving ratings at each rate, from Ordinary Seaman (OS) to Naval Warrant Officer (NWO).
6. {needs="ratings.new add"} Press **New Rating** at the top right to add a rating. See [Add a rating](#ratings-add-rating).

| Tile | What it counts |
|---|---|
| **Members** | All ratings, how many are current and how many are former |
| **Drafting** | Ratings who reported to a new ship this year, and the draft batches still open |
| **Disciplinary** | Cases waiting for a decision, and cases concluded this year |
| **Discharge** | Ratings discharged this year, and ratings waiting in a proposal |
| **Appraisals** | Appraisals recorded this month, and the appraisal periods still open |

> **Tip:** You see a tile only if your role may open the page it counts. A smaller Dashboard is not a fault.

```shot dashboard-overview
open: #dashboard
as: admin
crop: #app-main
height: 330
marks:
  1: css div.rounded-card:has(a[href="#disciplinary/pending"]) | A tile: the line at its foot opens the page it counts
```
