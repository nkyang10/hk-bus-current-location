# Deployment

Deploying is trivial — the entire app is a folder of static files.

## Build Step

**There is no build step.** The `v2/` folder is ready to deploy as-is.

## Deploy to Any Static Host

### Cloudflare Pages

1. Go to **Cloudflare Dashboard → Pages → Create a project**
2. Connect your GitHub repo
3. Build settings:
   - **Build command:** (none — leave blank)
   - **Build output directory:** `v2`
4. Deploy

### Netlify

1. **Netlify → Add new site → Import an existing project**
2. Connect your GitHub repo
3. Settings:
   - **Build command:** (none)
   - **Publish directory:** `v2`
4. Deploy

### GitHub Pages

Using GitHub Actions (create `.github/workflows/deploy.yml`):

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v4
        with:
          path: v2
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Any Static Server

```bash
# Just serve the v2/ folder
npx http-server v2 -p 8080
python -m http.server 8080 -d v2
```

## SPA Routing

Since the app uses URL query parameters (`?route=118`) rather than path-based routing (`/route/118`), **no SPA redirect rule is needed**. The `index.html` serves at the root and handles all query params in JavaScript.

If you want path-based URLs like `/route/118`, add a redirect rule to serve `index.html` for all paths:

**Cloudflare/Netlify (`_redirects`):**
```
/* /index.html 200
```

## Custom Domain

1. Add a CNAME record pointing to your hosting provider
2. Configure the domain in your hosting provider's settings
3. The app works at `https://yourdomain.com/?route=118`

## Performance

| File | Size | Gzipped |
|---|---|---|
| `index.html` | 1.5 KB | 0.8 KB |
| `css/style.css` | 8 KB | 2 KB |
| `js/*.js` (8 files) | 45 KB | 12 KB |
| jQuery (CDN) | 30 KB | 10 KB |
| Leaflet (CDN) | 145 KB | 40 KB |
| **Total** | **~230 KB** | **~65 KB** |
