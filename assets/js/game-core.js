/* =========================================================
   ANANTA GAMES — game-core.js
   Handles discovery of games inside /games via the GitHub API,
   parsing of GAME_INFO metadata, and localStorage caching.
   ========================================================= */

(function (global) {
  "use strict";

  /* -----------------------------------------------------
     CONFIG
     Leave owner/repo/branch as "auto" to detect them from
     the current GitHub Pages URL. If you are testing locally
     (e.g. via `python3 -m http.server`) auto-detection cannot
     work, since localhost is not a github.io URL — in that
     case, set owner/repo below by hand.
     ----------------------------------------------------- */
  var CONFIG = {
    owner: "auto",
    repo: "auto",
    branch: "auto",
    cacheKey: "ananta_games_cache_v1",
    cacheTtlMs: 15 * 60 * 1000, // 15 minutes
    gamesPath: "games"
  };

  /* -----------------------------------------------------
     Detect {owner, repo} from the current URL when running
     on GitHub Pages (either project pages or user/org pages).
     ----------------------------------------------------- */
  function detectRepoFromLocation() {
    var host = global.location.hostname; // e.g. "someuser.github.io"
    var isGithubPages = /\.github\.io$/i.test(host);

    if (!isGithubPages) {
      return { owner: null, repo: null };
    }

    var owner = host.split(".")[0];
    var pathParts = global.location.pathname.split("/").filter(Boolean);

    var repo;
    if (pathParts.length > 0) {
      // Project page: https://owner.github.io/repo-name/...
      repo = pathParts[0];
    } else {
      // User/org page: repo is literally named "owner.github.io"
      repo = host;
    }

    return { owner: owner, repo: repo };
  }

  function resolveConfig() {
    var resolved = {
      owner: CONFIG.owner,
      repo: CONFIG.repo,
      branch: CONFIG.branch
    };

    if (resolved.owner === "auto" || resolved.repo === "auto") {
      var detected = detectRepoFromLocation();
      if (resolved.owner === "auto") resolved.owner = detected.owner;
      if (resolved.repo === "auto") resolved.repo = detected.repo;
    }

    return resolved;
  }

  /* -----------------------------------------------------
     Fetch the repository's default branch when branch is "auto"
     ----------------------------------------------------- */
  function resolveBranch(owner, repo) {
    if (CONFIG.branch !== "auto") {
      return Promise.resolve(CONFIG.branch);
    }
    var url = "https://api.github.com/repos/" + owner + "/" + repo;
    return fetch(url, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not resolve default branch (HTTP " + res.status + ")");
        return res.json();
      })
      .then(function (data) {
        return data.default_branch || "main";
      })
      .catch(function () {
        // Fall back to the most common default if the repo lookup fails
        return "main";
      });
  }

  /* -----------------------------------------------------
     Parse the GAME_INFO metadata comment out of a game's
     raw HTML source. Expected format:

     <!-- GAME_INFO
     title: Snake
     description: Classic snake game.
     category: Arcade
     icon: 🐍
     featured: true
     -->
     ----------------------------------------------------- */
  function parseGameInfo(rawHtml, fallbackTitle) {
    var match = rawHtml.match(/<!--\s*GAME_INFO([\s\S]*?)-->/i);
    var info = {
      title: fallbackTitle,
      description: "",
      category: "Misc",
      icon: "🎮",
      featured: false
    };

    if (!match) return info;

    var block = match[1];
    var lines = block.split("\n");

    lines.forEach(function (line) {
      var idx = line.indexOf(":");
      if (idx === -1) return;
      var key = line.slice(0, idx).trim().toLowerCase();
      var value = line.slice(idx + 1).trim();
      if (!key || value === "") return;

      if (key === "title") info.title = value;
      else if (key === "description") info.description = value;
      else if (key === "category") info.category = value;
      else if (key === "icon") info.icon = value;
      else if (key === "featured") info.featured = /^true$/i.test(value);
    });

    return info;
  }

  /* -----------------------------------------------------
     Fetch the list of files inside /games, then fetch each
     file's raw content to extract its GAME_INFO metadata.
     ----------------------------------------------------- */
  function fetchGamesList(owner, repo, branch) {
    var listUrl =
      "https://api.github.com/repos/" + owner + "/" + repo +
      "/contents/" + CONFIG.gamesPath + "?ref=" + encodeURIComponent(branch);

    return fetch(listUrl, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (res) {
        if (res.status === 404) {
          // /games folder doesn't exist yet — treat as "no games"
          return [];
        }
        if (!res.ok) {
          throw new Error("GitHub API error (HTTP " + res.status + ")");
        }
        return res.json();
      })
      .then(function (items) {
        if (!Array.isArray(items)) return [];

        var htmlFiles = items.filter(function (item) {
          return item.type === "file" && /\.html?$/i.test(item.name);
        });

        var fetches = htmlFiles.map(function (item) {
          return fetch(item.download_url)
            .then(function (res) {
              if (!res.ok) throw new Error("Failed to fetch " + item.name);
              return res.text();
            })
            .then(function (rawHtml) {
              var fallbackTitle = item.name.replace(/\.html?$/i, "").replace(/[-_]/g, " ");
              var info = parseGameInfo(rawHtml, fallbackTitle);
              return {
                id: item.name,
                title: info.title,
                description: info.description,
                category: info.category,
                icon: info.icon,
                featured: info.featured,
                file: CONFIG.gamesPath + "/" + item.name
              };
            })
            .catch(function () {
              // If a single game fails to parse, skip it rather than
              // failing the whole discovery process.
              return null;
            });
        });

        return Promise.all(fetches).then(function (results) {
          return results.filter(Boolean);
        });
      });
  }

  /* -----------------------------------------------------
     Cache helpers
     ----------------------------------------------------- */
  function readCache(owner, repo, branch) {
    try {
      var raw = global.localStorage.getItem(CONFIG.cacheKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.timestamp || !parsed.games) return null;
      if (parsed.owner !== owner || parsed.repo !== repo || parsed.branch !== branch) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(owner, repo, branch, games) {
    try {
      var payload = {
        owner: owner,
        repo: repo,
        branch: branch,
        timestamp: Date.now(),
        games: games
      };
      global.localStorage.setItem(CONFIG.cacheKey, JSON.stringify(payload));
    } catch (e) {
      /* localStorage unavailable or full — skip caching silently */
    }
  }

  function isCacheFresh(cacheEntry) {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < CONFIG.cacheTtlMs;
  }

  /* -----------------------------------------------------
     Derive categories + stats from a games array
     ----------------------------------------------------- */
  function deriveCategories(games) {
    var set = {};
    games.forEach(function (g) {
      if (g.category) set[g.category] = true;
    });
    return Object.keys(set).sort();
  }

  function deriveStats(games) {
    return {
      total: games.length,
      categories: deriveCategories(games).length,
      featured: games.filter(function (g) { return g.featured; }).length
    };
  }

  /* -----------------------------------------------------
     Public entry point.
     options.forceRefresh — bypass cache and hit the API again.
     Returns a Promise resolving to:
       {
         games, categories, stats,
         source: "cache" | "network",
         stale: boolean,     // true if network failed and stale cache was used
         error: string|null,
         owner, repo, branch
       }
     ----------------------------------------------------- */
  function getGames(options) {
    options = options || {};
    var resolved = resolveConfig();

    if (!resolved.owner || !resolved.repo) {
      return Promise.resolve({
        games: [],
        categories: [],
        stats: { total: 0, categories: 0, featured: 0 },
        source: "none",
        stale: false,
        error:
          "Could not detect a GitHub repository from this URL. " +
          "If you're running the site locally, set owner/repo manually " +
          "in assets/js/game-core.js.",
        owner: resolved.owner,
        repo: resolved.repo,
        branch: null
      });
    }

    var cached = null;

    return resolveBranch(resolved.owner, resolved.repo).then(function (branch) {
      cached = readCache(resolved.owner, resolved.repo, branch);

      if (!options.forceRefresh && isCacheFresh(cached)) {
        return {
          games: cached.games,
          categories: deriveCategories(cached.games),
          stats: deriveStats(cached.games),
          source: "cache",
          stale: false,
          error: null,
          owner: resolved.owner,
          repo: resolved.repo,
          branch: branch
        };
      }

      return fetchGamesList(resolved.owner, resolved.repo, branch)
        .then(function (games) {
          writeCache(resolved.owner, resolved.repo, branch, games);
          return {
            games: games,
            categories: deriveCategories(games),
            stats: deriveStats(games),
            source: "network",
            stale: false,
            error: null,
            owner: resolved.owner,
            repo: resolved.repo,
            branch: branch
          };
        })
        .catch(function (err) {
          // Network / API failure — fall back to stale cache if we have one
          if (cached && cached.games) {
            return {
              games: cached.games,
              categories: deriveCategories(cached.games),
              stats: deriveStats(cached.games),
              source: "cache",
              stale: true,
              error: err.message || "Failed to reach the GitHub API.",
              owner: resolved.owner,
              repo: resolved.repo,
              branch: branch
            };
          }
          return {
            games: [],
            categories: [],
            stats: { total: 0, categories: 0, featured: 0 },
            source: "none",
            stale: false,
            error: err.message || "Failed to reach the GitHub API.",
            owner: resolved.owner,
            repo: resolved.repo,
            branch: branch
          };
        });
    });
  }

  /* -----------------------------------------------------
     Expose public API
     ----------------------------------------------------- */
  global.AnantaGameCore = {
    CONFIG: CONFIG,
    getGames: getGames,
    parseGameInfo: parseGameInfo,
    deriveCategories: deriveCategories,
    deriveStats: deriveStats
  };
})(window);
