# AnchorLinks — single-page owner-only uploads

This is a small single-page site that allows the site owner to upload daily anchor links. It's a static client-side demo that stores data in `localStorage`.

Features
- Single-page layout with Home / About / Contact sections
- Owner login (client-side) to add daily links (title, URL, optional date)
- Links are stored in the browser's `localStorage` and shown on the Home section
- Responsive and mobile-friendly

How to run
1. Open `index.html` in your browser (double-click). For improved behavior (CORS, nicer local testing), serve the folder using Python:

```powershell
# from the project folder (Windows PowerShell)
python -m http.server 8000 --directory .;
# then open http://localhost:8000 in your browser
```

Owner password
- By default the owner password is set in `main.js`:

```js
const OWNER_PASSWORD = 'owner123';
```

- Change that value to a secure password before using this site. Note: this demo uses a client-side password and is not secure for public production use.

Notes and next steps
- For a production site, implement server-side authentication and a backend database.
- Consider protecting the admin actions behind a proper login (JWT/session) and serve links from a server.
