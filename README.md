# FORMAT — website

Static site: plain HTML, CSS and JS. No build step.

```
index.html     Home
studio.html    FORMAT / Studio
archive.html   FORMAT / Archive (gallery)
fablab.html    FORMAT / FabLab (store)
contact.html   Contact
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

- **Contact form:** `ENDPOINT` in `contact.html` is empty, so submissions don't go anywhere yet. Set it to the URL of the backend that emails you and logs to the leads Google Sheet (for example a Google Apps Script web app).
- **FabLab checkout:** "Request to order" sends people to the contact form; there is no payment checkout yet.
- **Footer:** the Facebook link still points to facebook.com (marked `data-todo="facebook-profile-url"`).
