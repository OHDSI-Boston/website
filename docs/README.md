# OHDSI Boston website

Static site (HTML, CSS, ES modules). Deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` on push to `main`.

Page text lives in [`../content.md`](../content.md). The deploy renders it into `docs/index.html`.

## Run locally

```sh
pip install -r scripts/requirements.txt
python3 scripts/build_content.py   # after editing content.md
cd docs && python3 -m http.server 8000
```

Open http://localhost:8000.
