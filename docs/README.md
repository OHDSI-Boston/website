# OHDSI Boston website

Static site (HTML, CSS, ES modules). No build step. Deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` on push to `main`.

## Run locally

```sh
cd docs
python3 -m http.server 8000
```

Open http://localhost:8000.
