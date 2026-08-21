# Crafts ni Yukiii — React + Supabase

This is a React (Vite) port of your original single-file HTML app, using the
same Supabase backend and the same account-wipe fix from before (a shop's
data is never saved unless it was just successfully loaded — see
`src/lib/api.js` and `src/lib/ShopContext.jsx`).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Connect it to your Supabase project**
   Copy `.env.example` to `.env` and fill in your project's URL and anon key
   (Supabase Dashboard > Settings > API):
   ```bash
   cp .env.example .env
   ```

3. **Set up the database schema** (skip this if you're pointing at your
   existing project that already has `shops` and `shop_data` tables in this
   shape — just confirm the `email_for_username` function exists, since the
   original app used it for username-based login).
   Run `supabase-schema.sql` in the Supabase SQL Editor.

4. **Run it locally**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```
   This outputs static files to `dist/` — deploy that folder anywhere
   (Vercel, Netlify, Cloudflare Pages, or even Supabase Storage + a CDN).

## Structure

- `src/lib/supabaseClient.js` — Supabase client init
- `src/lib/api.js` — load/save functions (contains the wipe-bug fix)
- `src/lib/ShopContext.jsx` — global app state (auth, shop data, mutate())
- `src/lib/constants.js`, `src/lib/utils.js` — shared config and helpers
- `src/components/` — one component per tab/screen, matching the original
  app's sections: Auth, Sidebar, Overview, Products, Pos (sell/restock),
  Conventions, Costs, Reports, Breakdown, Showcase, Invite, Feedback,
  ImportTab (CSV), BackupTab (manual JSON export/import)

## Notes on the port

- All state mutations go through `mutate()` in `ShopContext`, which deep-clones
  the current data, applies your change, updates React state, and triggers a
  debounced (500ms) save — mirroring the original app's direct-mutate +
  `saveShopData()` pattern.
- The **Backup & restore** tab is new relative to the original — since you're
  on Supabase's Free plan with no automatic backups, this gives you a manual
  safety net (download/restore a JSON snapshot of everything).
- Some of the more elaborate original UI flourishes (multi-step bulk-add
  wizard, some sidebar animations) were simplified during the port to keep
  this manageable in one pass. The data model, business logic (stock
  deduction, bulk pin discounts, bundle creation, batch price edits,
  category/cost-type customization), and safety fix are all fully intact.
- This was verified with `esbuild` to bundle and resolve cleanly (no network
  access was available in this sandbox to run a full `npm install` + `vite
  build`) — run `npm run build` yourself before deploying to catch anything
  environment-specific.
