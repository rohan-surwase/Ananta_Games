/* =========================================================
   ANANTA GAMES — app.js
   Wires game-core.js discovery data into the homepage UI:
   search, category filters, theme toggle, stats, rendering.
   ========================================================= */

(function () {
  "use strict";

  var THEME_KEY = "ananta_theme";

  var els = {
    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.getElementById("themeIcon"),
    searchInput: document.getElementById("searchInput"),
    heroSearchInput: document.getElementById("heroSearchInput"),

    statTotal: document.getElementById("statTotal"),
    statCategories: document.getElementById("statCategories"),
    statFeatured: document.getElementById("statFeatured"),

    filters: document.getElementById("filters"),

    featuredSection: document.getElementById("featuredSection"),
    featuredGrid: document.getElementById("featuredGrid"),

    allGamesGrid: document.getElementById("allGamesGrid"),
    allGamesCount: document.getElementById("allGamesCount"),

    stateArea: document.getElementById("stateArea")
  };

  var appState = {
    allGames: [],
    categories: [],
    activeCategory: "All",
    searchTerm: ""
  };

  /* =========================================================
     THEME
     ========================================================= */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    if (els.themeIcon) els.themeIcon.textContent = theme === "dark" ? "☾" : "☀";
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (saved === "light" || saved === "dark") {
      applyTheme(saved);
    } else {
      var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      applyTheme(prefersLight ? "light" : "dark");
    }
  }

  if (els.themeToggle) {
    els.themeToggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* =========================================================
     RENDER HELPERS
     ========================================================= */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function cardTemplate(game) {
    var featuredBadge = game.featured
      ? '<span class="featured-badge">★ Featured</span>'
      : "";

    return (
      '<article class="game-card glass" data-card>' +
        '<div class="card-top">' +
          '<div class="icon-badge" aria-hidden="true">' + escapeHtml(game.icon || "🎮") + '</div>' +
          featuredBadge +
        '</div>' +
        '<h3>' + escapeHtml(game.title) + '</h3>' +
        '<p class="desc">' + escapeHtml(game.description || "No description provided.") + '</p>' +
        '<div class="card-bottom">' +
          '<span class="category-tag">' + escapeHtml(game.category || "Misc") + '</span>' +
          '<a class="play-btn" href="' + escapeHtml(game.file) + '">▶ Play</a>' +
        '</div>' +
      '</article>'
    );
  }

  function skeletonCards(count) {
    var out = "";
    for (var i = 0; i < count; i++) out += '<div class="skeleton-card" aria-hidden="true"></div>';
    return out;
  }

  function trackCardGlow(container) {
    container.querySelectorAll(".game-card").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width) * 100 + "%");
        card.style.setProperty("--my", ((e.clientY - rect.top) / rect.height) * 100 + "%");
      });
    });
  }

  /* =========================================================
     FILTERING
     ========================================================= */
  function getFilteredGames() {
    var term = appState.searchTerm.trim().toLowerCase();
    return appState.allGames.filter(function (g) {
      var matchesCategory = appState.activeCategory === "All" || g.category === appState.activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      var haystack = (g.title + " " + g.description + " " + g.category).toLowerCase();
      return haystack.indexOf(term) !== -1;
    });
  }

  /* =========================================================
     RENDER SECTIONS
     ========================================================= */
  function renderFilters() {
    if (!els.filters) return;
    var cats = ["All"].concat(appState.categories);
    els.filters.innerHTML = cats.map(function (cat) {
      var pressed = cat === appState.activeCategory;
      return (
        '<button type="button" class="filter-chip" data-category="' + escapeHtml(cat) + '" ' +
        'aria-pressed="' + pressed + '">' + escapeHtml(cat) + '</button>'
      );
    }).join("");

    els.filters.querySelectorAll(".filter-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        appState.activeCategory = btn.getAttribute("data-category");
        renderFilters();
        renderGrids();
      });
    });
  }

  function renderStats(stats) {
    if (els.statTotal) els.statTotal.textContent = stats.total;
    if (els.statCategories) els.statCategories.textContent = stats.categories;
    if (els.statFeatured) els.statFeatured.textContent = stats.featured;
  }

  function renderGrids() {
    var filtered = getFilteredGames();

    // Featured section only shows when there IS a featured game and no active search/filter noise
    var featured = filtered.filter(function (g) { return g.featured; });
    if (els.featuredSection) {
      els.featuredSection.style.display = featured.length > 0 ? "" : "none";
    }
    if (els.featuredGrid) {
      els.featuredGrid.innerHTML = featured.map(cardTemplate).join("");
      trackCardGlow(els.featuredGrid);
    }

    if (els.allGamesGrid) {
      if (filtered.length === 0) {
        els.allGamesGrid.innerHTML = "";
        renderEmptyState();
      } else {
        clearStateArea();
        els.allGamesGrid.innerHTML = filtered.map(cardTemplate).join("");
        trackCardGlow(els.allGamesGrid);
      }
    }

    if (els.allGamesCount) {
      els.allGamesCount.textContent = filtered.length + (filtered.length === 1 ? " game" : " games");
    }
  }

  function clearStateArea() {
    if (els.stateArea) els.stateArea.innerHTML = "";
  }

  function renderLoadingState() {
    if (els.allGamesGrid) els.allGamesGrid.innerHTML = skeletonCards(6);
    if (els.featuredGrid) els.featuredGrid.innerHTML = skeletonCards(3);
    clearStateArea();
  }

  function renderEmptyState() {
    if (!els.stateArea) return;
    var hasSearchOrFilter = appState.searchTerm.trim() !== "" || appState.activeCategory !== "All";
    els.stateArea.innerHTML =
      '<div class="state-panel glass">' +
        '<div class="state-icon">🕹️</div>' +
        '<h3>' + (hasSearchOrFilter ? "No games match" : "No games yet") + '</h3>' +
        '<p>' + (hasSearchOrFilter
          ? "Try a different search term or category."
          : "Add a standalone HTML file with a GAME_INFO comment to the /games folder and it will show up here automatically.") +
        '</p>' +
      '</div>';
  }

  function renderErrorState(message, options) {
    options = options || {};
    if (els.allGamesGrid) els.allGamesGrid.innerHTML = "";
    if (els.featuredGrid) els.featuredGrid.innerHTML = "";
    if (els.featuredSection) els.featuredSection.style.display = "none";
    if (!els.stateArea) return;

    els.stateArea.innerHTML =
      '<div class="state-panel glass">' +
        '<div class="state-icon">⚠️</div>' +
        '<h3>Couldn\u2019t load games</h3>' +
        '<p>' + escapeHtml(message) + '</p>' +
        '<button type="button" class="retry-btn" id="retryBtn">Try again</button>' +
        (options.stale ? '<div class="cache-note">Showing cached results from earlier.</div>' : '') +
      '</div>';

    var retryBtn = document.getElementById("retryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", function () { loadGames(true); });
    }
  }

  /* =========================================================
     SEARCH
     ========================================================= */
  function handleSearchInput(value) {
    appState.searchTerm = value;
    if (els.searchInput && els.searchInput.value !== value) els.searchInput.value = value;
    if (els.heroSearchInput && els.heroSearchInput.value !== value) els.heroSearchInput.value = value;
    renderGrids();
  }

  if (els.searchInput) {
    els.searchInput.addEventListener("input", function () { handleSearchInput(els.searchInput.value); });
  }
  if (els.heroSearchInput) {
    els.heroSearchInput.addEventListener("input", function () { handleSearchInput(els.heroSearchInput.value); });
  }

  /* =========================================================
     LOAD GAMES (via game-core.js)
     ========================================================= */
  function loadGames(forceRefresh) {
    renderLoadingState();

    window.AnantaGameCore.getGames({ forceRefresh: !!forceRefresh }).then(function (result) {
      if (result.error && result.games.length === 0) {
        renderErrorState(result.error, { stale: false });
        renderStats({ total: 0, categories: 0, featured: 0 });
        return;
      }

      appState.allGames = result.games;
      appState.categories = result.categories;
      renderStats(result.stats);
      renderFilters();
      renderGrids();

      if (result.error && result.stale) {
        // Non-fatal: network failed but we had a cache. Show a subtle banner
        // above the grid instead of replacing it.
        var banner = document.createElement("div");
        banner.className = "cache-note";
        banner.style.textAlign = "center";
        banner.style.marginBottom = "16px";
        banner.textContent = "Live data unavailable — showing cached results from earlier.";
        if (els.stateArea) {
          els.stateArea.innerHTML = "";
          els.stateArea.appendChild(banner);
        }
      }
    });
  }

  /* =========================================================
     INIT
     ========================================================= */
  initTheme();
  loadGames(false);
})();
