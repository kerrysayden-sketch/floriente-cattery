# Floriente Cattery — site

Astro + Storyblok + Cloudflare Pages. 5 locales (EN/UK/PL/DE/RU).

## Secrets handling

Real secret values never live in project files — neither git-tracked nor gitignored.
Local dev reads from macOS Keychain; production from Cloudflare Pages env Secrets.

### Adding this project to a new machine (local dev)

1. Get the Storyblok preview token from the Storyblok space (Settings → Access Tokens → Preview).
2. Store it in Keychain:
   ```sh
   security add-generic-password -a "$USER" -s 'florientecattery-storyblok-preview' -w '<paste-token>' -U
   ```
3. `npm install && npm run dev` — `scripts/load-env.sh` is sourced automatically and exports `STORYBLOK_TOKEN` from Keychain into the build process.

### Adding a new secret

- Pick a Keychain service name: `florientecattery-<purpose>`.
- Add it: `security add-generic-password -a "$USER" -s '<name>' -w '<value>' -U`.
- Teach `scripts/load-env.sh` to read it and export the matching env var.
- Add the var name (with empty value) to `.env.example` as documentation.
- Set the same name as a Secret in the Cloudflare Pages project env for production.

### Never

- Do **not** create a real `.env` file with actual values. `.env*` is gitignored (except `.env.example` template), but local disk is not secure storage — Time Machine, Spotlight, iCloud Drive and screenshots all leak.
- Do **not** embed tokens in npm scripts, git remote URLs, or any tracked file.
- Rotate immediately if a token value has been seen in a terminal paste, screenshot, or shared session.

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
| `npm run typecheck`       | Astro/TS check                                   |
| `npm run i18n:check`      | Verify i18n key parity across locales            |
| `npm run test:smoke`      | Playwright smoke tests (home, cookieless, PL/DE) |
| `npm run fonts:refresh`   | Re-download self-hosted Cormorant/Inter fonts    |

