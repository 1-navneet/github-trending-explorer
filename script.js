// ============================================================
// GitHub Trending Explorer — script.js
// All data manipulation uses Array HOFs (filter, map, sort, find, reduce)
// No traditional for/while loops used for data operations
// ============================================================

// ===== STATE =====
const state = {
  allRepos: [],        // raw data from API
  filteredRepos: [],   // after search + filter + sort
  bookmarks: [],       // saved repos (localStorage)
  currentPage: 1,
  perPage: 12,
  searchQuery: "",
  selectedLanguage: "",
  selectedSort: "stars",
  isLoading: false,
};

// ===== DOM ELEMENTS =====
const repoGrid        = document.getElementById("repoGrid");
const searchInput     = document.getElementById("searchInput");
const clearSearch     = document.getElementById("clearSearch");
const languageFilter  = document.getElementById("languageFilter");
const sortFilter      = document.getElementById("sortFilter");
const resultsInfo     = document.getElementById("resultsInfo");
const prevBtn         = document.getElementById("prevBtn");
const nextBtn         = document.getElementById("nextBtn");
const pageInfo        = document.getElementById("pageInfo");
const noResults       = document.getElementById("noResults");
const themeToggle     = document.getElementById("themeToggle");
const themeIcon       = document.getElementById("themeIcon");
const bookmarksToggle = document.getElementById("bookmarksToggle");
const bookmarksPanel  = document.getElementById("bookmarksPanel");
const bookmarksGrid   = document.getElementById("bookmarksGrid");
const bookmarkCount   = document.getElementById("bookmarkCount");
const clearBookmarks  = document.getElementById("clearBookmarks");

// ===== LANGUAGE COLOR MAP =====
const langColors = {
  JavaScript: "#f1e05a", Python: "#3572A5", TypeScript: "#2b7489",
  Java: "#b07219", "C++": "#f34b7d", C: "#555555", Rust: "#dea584",
  Go: "#00ADD8", PHP: "#4F5D95", Swift: "#F05138", Kotlin: "#A97BFF", Ruby: "#701516",
};

// ===== FORMAT NUMBERS =====
function formatNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num;
}

// ===== FORMAT DATE =====
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ===== FETCH REPOS FROM API =====
async function fetchRepos() {
  state.isLoading = true;
  showSkeletons();

  try {
    const query = `stars:>500${state.selectedLanguage ? ` language:${state.selectedLanguage}` : ""}`;
    const sort  = state.selectedSort === "updated" ? "updated" : "stars";
    const url   = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=100`;

    const res  = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!res.ok) throw new Error(`API Error: ${res.status}`);

    const data     = await res.json();
    state.allRepos = data.items;
    state.currentPage = 1;
    applyFilters();

  } catch (err) {
    repoGrid.innerHTML = `
      <div class="no-results" style="grid-column:1/-1">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h3>Something went wrong</h3>
        <p>${err.message}. Please try again later.</p>
      </div>`;
  } finally {
    state.isLoading = false;
  }
}

// ===== APPLY SEARCH + FILTER + SORT (All using Array HOFs) =====
function applyFilters() {
  const q = state.searchQuery.toLowerCase().trim();

  // HOF 1 — filter() : search by name or description
  let results = state.allRepos.filter((repo) => {
    const nameMatch = repo.name.toLowerCase().includes(q);
    const descMatch = repo.description ? repo.description.toLowerCase().includes(q) : false;
    return nameMatch || descMatch;
  });

  // HOF 2 — filter() : language filter
  if (state.selectedLanguage) {
    results = results.filter((repo) => repo.language === state.selectedLanguage);
  }

  // HOF 3 — sort() : sort by stars, forks, or updated
  results = results.sort((a, b) => {
    if (state.selectedSort === "stars")   return b.stargazers_count - a.stargazers_count;
    if (state.selectedSort === "forks")   return b.forks_count - a.forks_count;
    if (state.selectedSort === "updated") return new Date(b.updated_at) - new Date(a.updated_at);
    return 0;
  });

  state.filteredRepos = results;
  updateResultsInfo();
  renderPage();
}

// ===== RENDER CURRENT PAGE =====
function renderPage() {
  const start = (state.currentPage - 1) * state.perPage;
  const end   = start + state.perPage;

  // HOF 4 — slice + map() : get current page repos and render cards
  const pageRepos = state.filteredRepos.slice(start, end);

  if (pageRepos.length === 0) {
    repoGrid.innerHTML = "";
    noResults.classList.remove("hidden");
  } else {
    noResults.classList.add("hidden");
    // map() — convert each repo object into an HTML card string
    repoGrid.innerHTML = pageRepos.map((repo) => createRepoCard(repo)).join("");
  }

  updatePagination();
}

// ===== CREATE REPO CARD HTML =====
function createRepoCard(repo) {
  // HOF 5 — find() : check if this repo is already bookmarked
  const isBookmarked = state.bookmarks.find((b) => b.id === repo.id);
  const langColor    = langColors[repo.language] || "#8b949e";
  const langClass    = repo.language ? `lang-${repo.language.replace("+", "p")}` : "";

  return `
    <div class="repo-card" onclick="openRepo('${repo.html_url}')">
      <div class="repo-card-header">
        <img class="repo-avatar" src="${repo.owner.avatar_url}" alt="${repo.owner.login}" loading="lazy"/>
        <div class="repo-title-wrap">
          <a class="repo-name" href="${repo.html_url}" target="_blank" onclick="event.stopPropagation()">
            ${repo.name}
          </a>
          <div class="repo-owner">${repo.owner.login}</div>
        </div>
        <button
          class="bookmark-icon-btn ${isBookmarked ? "bookmarked" : ""}"
          onclick="event.stopPropagation(); toggleBookmark(${repo.id})"
          title="${isBookmarked ? "Remove bookmark" : "Bookmark this repo"}"
        >
          <i class="fa-${isBookmarked ? "solid" : "regular"} fa-bookmark"></i>
        </button>
      </div>

      <p class="repo-description">
        ${repo.description || "<em style='opacity:0.5'>No description provided</em>"}
      </p>

      <div class="repo-footer">
        <span class="repo-stat">
          <i class="fa-solid fa-star"></i>
          ${formatNumber(repo.stargazers_count)}
        </span>
        <span class="repo-stat">
          <i class="fa-solid fa-code-fork"></i>
          ${formatNumber(repo.forks_count)}
        </span>
        <span class="repo-stat">
          <i class="fa-regular fa-clock"></i>
          ${formatDate(repo.updated_at)}
        </span>
        ${repo.language ? `
          <span class="lang-badge" style="margin-left:auto">
            <span class="lang-dot ${langClass}" style="background:${langColor}"></span>
            ${repo.language}
          </span>` : ""}
      </div>
    </div>`;
}

// ===== OPEN REPO IN NEW TAB =====
function openRepo(url) {
  window.open(url, "_blank");
}

// ===== UPDATE RESULTS INFO =====
function updateResultsInfo() {
  // HOF 6 — reduce() : total stars of all filtered repos
  const totalStars = state.filteredRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  resultsInfo.textContent = `${state.filteredRepos.length} repositories found · ${formatNumber(totalStars)} total stars`;
}

// ===== UPDATE PAGINATION =====
function updatePagination() {
  const totalPages = Math.ceil(state.filteredRepos.length / state.perPage);
  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= totalPages;
  pageInfo.textContent = `Page ${state.currentPage} of ${totalPages || 1}`;
}

// ===== SHOW SKELETON CARDS =====
function showSkeletons() {
  repoGrid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join("");
  noResults.classList.add("hidden");
}

// ===== BOOKMARK FUNCTIONS =====
function toggleBookmark(repoId) {
  // HOF 7 — find() : check if already bookmarked
  const existing = state.bookmarks.find((b) => b.id === repoId);

  if (existing) {
    // HOF 8 — filter() : remove from bookmarks
    state.bookmarks = state.bookmarks.filter((b) => b.id !== repoId);
  } else {
    // HOF 9 — find() : find repo in allRepos to add to bookmarks
    const repo = state.allRepos.find((r) => r.id === repoId);
    if (repo) state.bookmarks.push(repo);
  }

  saveBookmarks();
  renderPage();
  renderBookmarks();
  updateBookmarkCount();
}

function renderBookmarks() {
  if (state.bookmarks.length === 0) {
    bookmarksGrid.innerHTML = `<p class="empty-bookmarks">No bookmarks yet. Click the bookmark icon on any repo!</p>`;
    return;
  }

  // HOF 10 — map() : render bookmark mini cards
  bookmarksGrid.innerHTML = state.bookmarks.map((repo) => `
    <div class="repo-card" onclick="openRepo('${repo.html_url}')">
      <div class="repo-card-header">
        <img class="repo-avatar" src="${repo.owner.avatar_url}" alt="${repo.owner.login}" loading="lazy"/>
        <div class="repo-title-wrap">
          <span class="repo-name">${repo.name}</span>
          <div class="repo-owner">${repo.owner.login}</div>
        </div>
        <button class="bookmark-icon-btn bookmarked"
          onclick="event.stopPropagation(); toggleBookmark(${repo.id})"
          title="Remove bookmark">
          <i class="fa-solid fa-bookmark"></i>
        </button>
      </div>
      <div class="repo-footer">
        <span class="repo-stat"><i class="fa-solid fa-star"></i> ${formatNumber(repo.stargazers_count)}</span>
      </div>
    </div>`).join("");
}

function updateBookmarkCount() {
  bookmarkCount.textContent = state.bookmarks.length;
  bookmarkCount.style.display = state.bookmarks.length === 0 ? "none" : "inline";
}

function saveBookmarks() {
  localStorage.setItem("gte-bookmarks", JSON.stringify(state.bookmarks));
}

function loadBookmarks() {
  const saved = localStorage.getItem("gte-bookmarks");
  state.bookmarks = saved ? JSON.parse(saved) : [];
}

// ===== THEME =====
function loadTheme() {
  const saved = localStorage.getItem("gte-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  themeIcon.className = saved === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next    = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("gte-theme", next);
  themeIcon.className = next === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
}

// ===== DEBOUNCE (Bonus feature) =====
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ===== EVENT LISTENERS =====

// Search with debounce
const handleSearch = debounce(() => {
  state.searchQuery = searchInput.value;
  state.currentPage = 1;
  clearSearch.classList.toggle("visible", searchInput.value.length > 0);
  applyFilters();
}, 400);

searchInput.addEventListener("input", handleSearch);

// Clear search
clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  state.searchQuery = "";
  clearSearch.classList.remove("visible");
  state.currentPage = 1;
  applyFilters();
});

// Language filter — fetches new data from API with language query
languageFilter.addEventListener("change", () => {
  state.selectedLanguage = languageFilter.value;
  state.currentPage = 1;
  fetchRepos();
});

// Sort filter
sortFilter.addEventListener("change", () => {
  state.selectedSort = sortFilter.value;
  state.currentPage = 1;
  applyFilters();
});

// Pagination
prevBtn.addEventListener("click", () => {
  if (state.currentPage > 1) { state.currentPage--; renderPage(); window.scrollTo(0, 0); }
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(state.filteredRepos.length / state.perPage);
  if (state.currentPage < totalPages) { state.currentPage++; renderPage(); window.scrollTo(0, 0); }
});

// Theme toggle
themeToggle.addEventListener("click", toggleTheme);

// Bookmarks panel toggle
bookmarksToggle.addEventListener("click", () => {
  bookmarksPanel.classList.toggle("open");
  renderBookmarks();
});

// Clear all bookmarks
clearBookmarks.addEventListener("click", () => {
  state.bookmarks = [];
  saveBookmarks();
  renderBookmarks();
  updateBookmarkCount();
  renderPage();
});

// ===== INIT =====
function init() {
  loadTheme();
  loadBookmarks();
  updateBookmarkCount();
  fetchRepos();
}

init();
