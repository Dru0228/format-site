# FORMAT — website

Static site: plain HTML, CSS and JS. No build step.

```
index.html     Home
studio.html    FORMAT / Studio
archive.html   FORMAT / Archive (gallery)
fablab.html    FORMAT / FabLab Drop (pre-order with size runs, concepts with voting, waitlist)
fablab-v1.html Previous FabLab store page (kept for rollback, noindex)
contact.html   Contact
audio.html     FORMAT / Audio (tracks, licensing, Blind Drive)
apps-script/   Backends (Google Apps Script): Code.gs = contact form, FabLab.gs = FabLab votes / waitlist / stock
analytics.js   Visitor analytics (GoatCounter), loaded by every page
stats.html     Private stats dashboard (not linked, not indexed)
assets/        Images and the hero video
```

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Deploy

Any static host works. Point it at the repo root; there is no build command.

- **GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root.
- **Netlify / Vercel / Cloudflare Pages:** import the repo, leave the build command empty, publish directory `/`.

Then add your custom domain in the host's settings and update DNS at your registrar.

## Still to wire up

- **Audio:** fill in `TRACKS`, `TIERS` (prices and checkout links) and `DRIVE` at the top of the script in `audio.html`. Only tracks that aren't on Spotify go on this page or the Blind Drive.
- **FabLab checkout:** "Request to order" sends people to the contact form; there is no payment checkout yet.
- **Footer:** the Facebook link still points to facebook.com (marked `data-todo="facebook-profile-url"`).

## Contact form

`apps-script/Code.gs` emails every message to `NOTIFY_EMAIL` (info@madebyformat.com) and logs it to a Google Sheet.

1. Create a Google Sheet named **FORMAT leads**.
2. In the sheet, open **Extensions → Apps Script**, delete the sample code, paste in `apps-script/Code.gs` and save.
3. Click **Deploy → New deployment**, choose type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**. Approve the permissions Google asks for.
4. Copy the **Web app URL** and set it as `ENDPOINT` in `contact.html`.

Open the URL in a browser to check it: it should say "FORMAT contact form is running." Replying to one of the emails replies to the visitor. If you change the script later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Analytics

Every page loads `analytics.js`, which sends visits to [GoatCounter](https://www.goatcounter.com) (free, no cookies, so no consent banner). The dashboard is at **https://madebyformat.goatcounter.com**.

One-time setup: sign up at https://www.goatcounter.com/signup with the code **madebyformat**. Counting starts as soon as that account exists. (To use a different code, change `CODE` at the top of `analytics.js`.)

What it records:

- **Page views:** visitors, pages, referrers (Instagram, Google…), countries, browsers, screen sizes.
- **Events** (shown in the same list, marked as events):
  - `outbound/<site>`: clicks on links to other sites (Instagram, checkout links…)
  - `contact-form-sent`: a contact form message went through; the title names the service picked.

**Phone-friendly dashboard:** open https://madebyformat.com/stats. The first time on each device it asks for a GoatCounter API token (open https://madebyformat.goatcounter.com/user/api, under the account menu at the top right, then New API token, tick only **Read statistics**). The token is kept in that browser only; tap **Disconnect this device** to remove it. On iPhone, Share → Add to Home Screen makes it an app icon.

Visits from `localhost` aren't counted. To leave out your own visits, open the dashboard's **Settings → Ignore IPs** and add yours. To track another click, call `track('name')` from a page script.

## FabLab Drop (fablab.html)

The previous page is kept as `fablab-v1.html` (hidden from search engines). To roll back, rename `fablab.html` to `fablab-drop.html` and `fablab-v1.html` to `fablab.html`, and delete the `robots` meta line.

**Layout:** a Pre-order section (3 pieces, 50 units each, live "X of 50 left" countdown, waitlist) and a Concepts section (everything else: vote for the piece and for a color, waitlist, "on the board" age, and a Most wanted top 3 by day / week / month / year).

### Set up the sheet (once)

1. Create a Google Sheet named **FORMAT FabLab**.
2. **Extensions → Apps Script**, delete the sample code, paste in `apps-script/FabLab.gs`, save. Open it from the sheet's own **Extensions** menu, not from script.google.com: a standalone script is not attached to the sheet and every vote and signup fails.
3. Reload the sheet, then use the new **FabLab → Set up / refresh dashboard** menu (approve the permissions). This creates the Items, Sizes, Votes, Waitlist, Orders and Dashboard tabs. If you already ran setup before the size-run update, paste in the new `FabLab.gs`, run setup again, and deploy a **new version** (Deploy → Manage deployments → Edit → New version) so the URL stays the same.
Votes, waitlist signups, notes and pre-orders email `NOTIFY_EMAIL` (top of `FabLab.gs`), at most one email per visitor per 10 minutes (pre-orders always send), each listing everything that visitor did on the piece. The sheet records every action, including the visitor's optional note in a Message column. After pasting the script, run `setup` once so Google asks to approve the mail permission.
4. **Deploy → New deployment → Web app**, Execute as **Me**, access **Anyone**. Copy the URL.
5. In `fablab.html` set `ENDPOINT` (top of the script) to that URL. The "Preview" banner disappears once it is set.

### Running a drop

- **Items tab** is the roster. `Status` (Pre-order / Concept) decides which section a piece appears in, `Cap` is the unit limit (blank = 50), `Listed` is the date used for "on the board". Change a status and the site follows within about a minute.
- **Sizes tab** sets how many of each size you make, per color. Starting runs: Signal Tee 60 (6 colors x 10), Field Polo 30 (4 colors: 8, 8, 7, 7, because 30 does not split evenly), Core Hoodie 30 (3 colors x 10). Edit the `Cap` numbers to match what you actually order; `Taken` and `Left` fill in by themselves. A piece with no rows here is limited only by `Cap` in the Items tab. If you change a run, also change `RUN` near the top of the script in `fablab.html` (it only drives the "N made" text before live numbers load) and the colors in the Items tab.
- **Orders tab:** people pick a color and size on the page and submit their name and email. Each submission holds a unit immediately. When a size in a color is full, its button turns grey and says "Sold out" and the server refuses more, so two people cannot take the last one. One email can hold 2 units per piece (`MAX_PER_PERSON` in the script). You get an email for each submission (`NOTIFY_EMAIL`); reply to it to reach the person. Rows start as `Requested`; set `Confirmed` once you have confirmed with them, or `Cancelled` to free the unit for someone else.
- **Dashboard tab:** units taken, days to sell out, units/day, votes, favorite colors, waitlist size, and charts. It updates itself.
- **Waitlist tab:** emails with the piece and whether it came from a concept or a pre-order.
- Votes are one piece vote and one color vote per browser per concept. This is a popularity signal, not an election; a determined person can vote again from another device or browser.
- To change the drop name, edit the "FabLab Drop, 2026 Q4" text in `fablab.html`.
