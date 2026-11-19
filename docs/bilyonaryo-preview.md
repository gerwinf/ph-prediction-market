# Bilyonaryo × Hula concept

The smallest editorial-to-prediction demo, within the existing Next.js app.
No new dependencies or database migrations.

## Design reference

The original single-column editorial layout is used on both mobile and desktop:
a text masthead, visible section tabs, two text-led stories, and the business
headline list. There are no hero illustrations, newspaper columns, or mobile
menu. The theme follows Hula's cream, forest-green, and orange palette, with
Instrument Serif headlines, Inter Tight body text, and JetBrains Mono labels.
The same fonts are used on the embedded widget and Hula market pages.

The Bilyonaryo masthead remains text, as requested in the brief. No publisher
photographs, logo assets, or article body copy are reproduced.

## Open it

Run the usual development command, then visit `/bilyonaryo`.

- `/bilyonaryo`: editorial feed; Top, Politics, Business, and Sports filters.
- `/bilyonaryo/story/sara-duterte-senate-verdict`: Politiko article preview.
- `/bilyonaryo/story/alex-eala-australian-open`: Abante article preview.
- `/m/sara-duterte-senate-verdict-2026?side=yes&src=bilyonaryo`: Hula market preview.
- `/m/alex-eala-australian-open-2027-quarterfinals?side=no&src=bilyonaryo`: second market.

The demo is three taps: headline → Yes or No → Continue on Hula. The sheet
offers 100, 500, or 1,000 play points. Returns include the stake, use the
chosen side’s probability, and round down to whole points. A share returns
100 play points on a correct prediction; nothing is actually purchased.

## Domain

The intended address is **bilyonaryo.hulaan.ph**. Connect that domain to
the existing Vercel project and follow the DNS instructions Vercel supplies.
Deploy this branch through the existing Vercel workflow. No domain or DNS
settings are changed by this implementation.

Middleware serves `/bilyonaryo` at that hostname’s `/`, and rewrites
`/story/<id>` to the corresponding article. From that hostname, Continue on
Hula opens `https://hulaan.ph/m/<slug>?side=<yes|no>&src=bilyonaryo` in a new
tab. Both domains must serve this code for the cross-domain demo to work.
On localhost and Vercel previews the handoff stays on the current origin,
so the complete flow can be reviewed before production deployment.

## Content

Edit `lib/bilyonaryo/content.json` to refresh the edition, headlines, links,
standfirsts, probabilities, and resolution rules. Chips, ticker, widget,
sheet, and market pages share these two market records.

Both featured stories and all six business headlines link directly to
Bilyonaryo. The featured impeachment and Eala stories were published on
10 November 2026 and are credited to Reuters. Their canonical URLs were
verified on 19 November 2026. Feed and article dates come from each story's
record. The Eala standfirst explicitly introduces the Australian Open
question as Hula's forward-looking prediction, rather than suggesting the
source article is an Australian Open preview. Only headlines and our own
standfirsts are displayed; no publisher body copy or photographs are reproduced.

## Reservations

The dedicated `/api/bilyonaryo/waitlist` endpoint uses the existing
`RESEND_API_KEY` and `RESEND_AUDIENCE_ID` settings. It stores only the name
(`first_name`) and email in that audience. It sends no notification emails,
creates no account, and does not guarantee a unique handle. Missing
configuration and provider errors are shown honestly, without a false
success. Automated checks mock the provider; they do not add real contacts.

## Preview boundaries

Each screen is labeled as an independent Hula concept. All probabilities
are illustrative and all amounts use play points. Preview pages have
`noindex, nofollow, noarchive` metadata and HTTP headers, are absent from
the sitemap, and bypass session refresh. The dedicated subdomain returns
a disallow-all `robots.txt`. The unlisted URL is not an authentication
boundary; use Vercel access protection if attendee-only access is needed.

The brief calls for Bilyonaryo’s written approval and counsel’s wording
review before external use. Neither approval is represented as granted.

## Verification

`npm test` covers shared market data, payout arithmetic, side/source links,
hostname rewrites, preserved Hula session behavior, and waitlist validation
and failure cases. Browser checks cover both article flows, new-tab handoff,
side selection, modal keyboard behavior, form failure/retry, search exclusion,
404s, and layouts at 320, 390, 768, and 1440 pixels.
