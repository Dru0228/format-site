# FORMAT — website

Static site: plain HTML, CSS and JS. No build step.

```
index.html     Home
studio.html    FORMAT / Studio
archive.html   FORMAT / Archive (gallery)
fablab.html    FORMAT / FabLab (store)
contact.html   Contact
audio.html     FORMAT / Audio (tracks, licensing, Blind Drive)
apps-script/   Contact form backend (Google Apps Script)
analytics.js   Visitor analytics (GoatCounter), loaded by every page
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

Visits from `localhost` aren't counted. To leave out your own visits, open the dashboard's **Settings → Ignore IPs** and add yours. To track another click, call `track('name')` from a page script.
