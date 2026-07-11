# Ananta Games

A self-discovering browser game library built with plain HTML, CSS, and
JavaScript. No frameworks, no build tools, no backend — deploys straight to
GitHub Pages.

Games aren't listed in a manifest or JSON file. The homepage asks the GitHub
API what's inside the `/games` folder, reads a small metadata comment out of
each game file, and builds the entire library — cards, categories, filters,
and stats — from that at page-load time.

## Project structure

```
ananta-games/
├── index.html                 Homepage — search, filters, featured games, stats
├── assets/
│   ├── favicon.svg             Infinity + game controller mark
│   ├── css/
│   │   └── style.css           Design tokens + all component styles
│   └── js/
│       ├── game-core.js        GitHub API discovery, metadata parsing, caching
│       └── app.js              Homepage rendering, search, filters, theme
├── games/
│   ├── snake.html               Sample game (Arcade, featured)
│   └── memory-match.html        Sample game (Puzzle)
└── README.md
```

## How discovery works

1. On page load, `app.js` calls `AnantaGameCore.getGames()` from
   `game-core.js`.
2. `game-core.js` figures out the current GitHub `owner` and `repo` from the
   page's own URL (see **Configuration** below), then calls:
   ```
   GET https://api.github.com/repos/{owner}/{repo}/contents/games
   ```
3. For every `.html` file returned, it fetches the file's raw content and
   parses the `GAME_INFO` comment at the top of the file.
4. The parsed games are used to render the game grid, the featured section,
   the category filter chips, and the stats strip (total games, categories,
   featured count) — all automatically, with no other file to edit.
5. Results are cached in `localStorage` for **15 minutes** so repeat visits
   don't re-hit the GitHub API. If the API is unreachable (rate limit, no
   network), the site falls back to the last cached copy and shows a small
   notice instead of breaking.

## Adding a new game

Only two steps — nothing else needs editing:

1. **Create one standalone HTML file inside `/games`.** It should be fully
   self-contained (its own `<style>` and `<script>`, no external JS
   dependencies) so it works offline and is easy to review on its own.

2. **Add a `GAME_INFO` metadata comment at the very top of the file:**

   ```html
   <!-- GAME_INFO
   title: Tetris
   description: Stack the falling blocks and clear as many lines as you can.
   category: Arcade
   icon: 🧱
   featured: false
   -->
   ```

   | Field         | Required | Notes                                   |
   |---------------|----------|------------------------------------------|
   | `title`       | Yes      | Shown on the game card                   |
   | `description` | Yes      | One sentence, shown on the card          |
   | `category`    | Yes      | Powers the auto-generated filter chips   |
   | `icon`        | Yes      | Any emoji, shown on the card              |
   | `featured`    | No       | `true`/`false` — `true` adds a badge and shows it in the Featured section |

3. Push it to GitHub. That's it — no manifest, no JSON file, no
   `games-data.js` to touch. The homepage will pick it up the next time its
   cache expires (or immediately, if you clear `localStorage`).

## Configuration

`assets/js/game-core.js` auto-detects the GitHub `owner` and `repo` from the
page's own URL:

- **Project page** (`https://<owner>.github.io/<repo>/…`) → owner and repo
  are read from the hostname and the first path segment.
- **User/organization page** (`https://<owner>.github.io/…`) → the repo is
  assumed to be named `<owner>.github.io`, per GitHub's convention.

If you're testing locally (e.g. `python3 -m http.server`), auto-detection
can't work since `localhost` isn't a GitHub Pages URL. In that case, open
`assets/js/game-core.js` and set `owner` / `repo` by hand at the top of the
file:

```js
var CONFIG = {
  owner: "your-github-username",
  repo: "your-repo-name",
  branch: "auto", // or a specific branch name
  ...
};
```

## Running it locally

No build step needed:

- Open `index.html` directly in a browser, or
- Serve the folder, e.g. `python3 -m http.server 8000`, then visit
  `http://localhost:8000`.

Remember: local discovery only works if you've set `owner`/`repo` manually
(see **Configuration**) and that repo is public on GitHub, since the API
calls always hit the real GitHub API — there's no local file listing.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo settings, enable **Pages** → **Deploy from branch** → select
   your default branch and the `/ (root)` folder.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

## Theme

Dark/light theme is controlled by a `data-theme` attribute and persisted in
`localStorage` under the key `ananta_theme`. It defaults to dark, or to your
OS preference if you've never toggled it.

## Design language

Dark-first, glassmorphism-leaning UI built around three brand colors —
violet (`#8B5CF6`), cyan (`#06B6D4`), and amber (`#F59E0B`) — with Space
Grotesk for display type and Inter for body text. Game cards use a soft
cursor-tracked glow on hover, and the hero has a slow-rotating gradient glow
behind the headline.

## Rate limits

The GitHub Contents API allows **60 unauthenticated requests per hour per
IP** for listing `/games`. Each individual game's raw source is fetched from
`raw.githubusercontent.com` via each file's `download_url`, which is not
subject to that same limit. The 15-minute cache keeps normal browsing well
within these limits.
