# Store listing copy & Data Safety cheat sheet

Copy-paste into the Play Console (and reuse for App Store Connect later).

## App title (max 30 chars)
```
The Pigsty: Pig Farm Manager
```

## Short description (max 80 chars)
```
Track pigs, weights, feed, breeding & farm finances — on the farm or abroad.
```

## Full description (max 4000 chars)
```
The Pigsty is a complete pig farm management app that replaces scattered
notebooks and spreadsheets with one clear source of truth — whether you're on
the farm or supporting it from abroad.

Track every animal from birth or purchase to sale, monitor growth and health,
manage your team, and see how the farm is really performing.

KEY FEATURES

• Pig lifecycle tracking — register pigs, tag numbers, breeds, and stages from
  piglet to finisher, boar, sow or gilt.
• Weights & growth — log weights and see average daily gain (ADG) against
  target growth curves, so you know which pigs are on track.
• Breeding records — farrowing, litters, weaning, and serviced-sow tracking.
• Pens & housing — organise animals by pen with occupancy at a glance.
• Feed management — record feed purchases and daily usage, in kilograms or
  buckets, and track feed cost and conversion.
• Financials — capture sales and expenses and see profitability per farm.
• Reports — herd inventory, weight gain, activity, and daily summaries you can
  export (PDF/Excel) on the web.
• Team management — invite owners, farm managers, and workers with the right
  permissions for each role.
• Health & observations — record vaccinations, treatments, and daily welfare
  checks.
• AI farm assistant — ask questions about your herd in plain language.
• Works offline-friendly and syncs with your farm's secure cloud account.

BUILT FOR PIG FARMERS
From smallholders to commercial operations — and especially for diaspora owners
who need to keep an eye on the farm from anywhere.

Your data is private to your farm and protected with secure, encrypted
connections. A free tier is available with no card required.

Subscriptions (Grower and Enterprise plans) are managed on our website at
the-pigsty.org.
```

## What's new (release notes, max 500 chars)
```
First release of The Pigsty for Android! Manage your whole pig operation from
your phone: pigs, weights and ADG, breeding, pens, feed, finances, reports,
team, and an AI farm assistant. Thanks for trying it — send feedback to
pigfarm@the-pigsty.org.
```

## Category & contact
- Category: **Business** (or Productivity)
- Contact email: `pigfarm@the-pigsty.org`
- Website: `https://the-pigsty.org`
- Privacy policy URL: `https://the-pigsty.org/privacy`

---

## Data Safety form cheat sheet (Google Play)

Answer the Data Safety questionnaire as follows (adjust if you change the app):

**Does your app collect or share required user data?** Yes (collect), no sharing
with third parties for advertising.

**Data collected (all: collected, linked to the user, not shared, mandatory for
core functionality unless noted):**

| Data type | Category | Purpose |
|---|---|---|
| Name | Personal info | Account management |
| Email address | Personal info | Account management, app functionality, comms |
| Phone number | Personal info | Account management, account recovery (SMS codes) |
| User-generated content (pig/farm records, notes, photos of feed receipts) | App info & performance / Photos | App functionality |
| App activity / in-app actions | App activity | Analytics, app functionality |

**Payment info:** NOT collected in the app (subscriptions are handled on the
website via Stripe; the app collects no card data).

**Location / Contacts / Calendar / Messages / Health / Files & media browsing:**
NOT collected. The app requests only the INTERNET permission. Feed-receipt and
profile photos are chosen by the user via the system picker (no broad storage
access).

**Security practices:**
- Data is encrypted in transit (HTTPS/TLS). ✅
- Users can request that their data be deleted. ✅ (requires in-app account
  deletion — see compliance notes)
- Committed to Play Families policy: N/A (not targeting children).

**Account deletion URL (required):**
`https://the-pigsty.org/account-security` (or a dedicated delete page) — must let
users request account + data deletion.

---

## App content questionnaires (Play Console)
- **Content rating:** complete IARC questionnaire — this is a business tool with
  no objectionable content → expect "Everyone / PEGI 3".
- **Target audience:** 18+ (business/farming tool), not directed at children.
- **Ads:** declare **No ads**.
- **Government app / Financial features:** it records a user's own farm finances
  but is not a bank/lending/payments app — answer the financial-features section
  accordingly (no third-party payments in-app).
