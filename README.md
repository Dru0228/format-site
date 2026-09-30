# FORMAT — website

Homepage for FORMAT, a creative studio in Houston, TX (est. 2026): photo, video and FPV production, a media archive, and FabLab apparel.

## What's here

```
index.html        The whole page: HTML, CSS and JavaScript in one file
assets/img/       Photography (web-sized JPEGs)
assets/img/gallery/  The 36 gallery photographs
assets/logo/      FORMAT wordmark, ink (dark) and paper (light) versions
```

No build step and no dependencies. Fonts (Barlow, Michroma) load from Google Fonts.

## Preview locally

Open `index.html` in a browser, or run a local server from this folder:

```
python3 -m http.server 8000
```

then visit http://localhost:8000.

## Publish free with GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open Settings › Pages.
3. Under "Build and deployment", choose "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Before launch

- Contact form: sends to afleming888@gmail.com.
- Social links: Instagram goes to @andrewlfleming. Facebook still points to facebook.com; search `index.html` for `facebook-profile-url` and replace the link with your profile URL.
- Logo: the wordmark PNGs are traced from the mockup. Swap in vector (SVG) files when you have them.
- Gallery: lives at `index.html#gallery`. To add a photo, drop it in `assets/img/gallery/` and copy one of the `<button class="gi">` lines in `index.html`, then add its title to the list near `// gallery page` in the script.

## Editing photos

Replace a file in `assets/img/` with a new image of the same name, or change the `src` in `index.html`. Keep images around 1,400–2,000px on the long edge and under ~500 KB.
