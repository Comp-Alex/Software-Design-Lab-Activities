const TRACKS_URL = "data/tracks.json";
const PROJECT_URL = "data/project.json";
const STORAGE_KEY = "designlab.completed-topics.v1";
const TRACK_META = {
  uml: { label: "UML DIAGRAMS", icon: "◇", description: "Map a system's structure, interactions, and behavior." },
  patterns: { label: "DESIGN PATTERNS", icon: "⌘", description: "Explore reusable approaches to common design problems." },
  concepts: { label: "ENGINEERING CONCEPTS", icon: "✳", description: "Build practical fluency in software design fundamentals." },
};

const trackGrid = document.querySelector("#track-grid");
const searchInput = document.querySelector("#track-search");
const filterSelect = document.querySelector("#track-filter");
let tracks = [];
let completedTopics = loadCompletedTopics();

function loadCompletedTopics() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function saveCompletedTopics() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedTopics]));
  } catch {
    document.querySelector(".storage-note").textContent =
      "Progress could not be saved in this browser. Your current checkmarks remain visible until you leave this page.";
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function allTopics() {
  return tracks.flatMap((track) => track.topics.map((topic) => ({ ...topic, trackId: track.id })));
}

function updateProgress() {
  const topics = allTopics();
  const done = topics.filter((topic) => completedTopics.has(topic.id)).length;
  const percent = topics.length ? Math.round((done / topics.length) * 100) : 0;
  document.querySelector("#overall-progress").textContent = percent;
  document.querySelector("#progress-count").textContent = `${done} of ${topics.length} topics`;
  document.querySelector("#overall-progress-bar").style.width = `${percent}%`;
  document.querySelector("#track-topic-count").textContent = topics.length;

  for (const track of tracks) {
    const complete = track.topics.filter((topic) => completedTopics.has(topic.id)).length;
    const trackPercent = track.topics.length ? Math.round((complete / track.topics.length) * 100) : 0;
    document.querySelector(`#${track.id}-progress`).textContent = complete;
    document.querySelector(`#${track.id}-total`).textContent = `/ ${track.topics.length}`;
    document.querySelector(`#${track.id}-progress-bar`).style.width = `${trackPercent}%`;
  }
}

function topicMatches(topic, filter) {
  return filter === "all" || (filter === "done" ? completedTopics.has(topic.id) : !completedTopics.has(topic.id));
}

function renderTracks() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filter = filterSelect.value;
  const cards = tracks.map((track) => {
    const meta = TRACK_META[track.id];
    const visibleTopics = track.topics.filter((topic) =>
      topicMatches(topic, filter) &&
      `${topic.name} ${topic.source || ""} ${meta.label} ${meta.description}`.toLocaleLowerCase().includes(query),
    );
    if (!visibleTopics.length) return "";
    const done = track.topics.filter((topic) => completedTopics.has(topic.id)).length;
    const percent = track.topics.length ? Math.round((done / track.topics.length) * 100) : 0;
    const topicsMarkup = visibleTopics.map((topic) => {
      const isDone = completedTopics.has(topic.id);
      const source = topic.href
        ? `<a class="topic-source" href="../${escapeHTML(topic.href)}" target="_blank" rel="noreferrer">SOURCE ↗</a>`
        : "";
      return `<li class="topic-item${isDone ? " is-done" : ""}">
        <button class="topic-check" type="button" data-topic-id="${escapeHTML(topic.id)}" aria-pressed="${isDone}" aria-label="${isDone ? "Mark incomplete" : "Mark complete"}: ${escapeHTML(topic.name)}">✓</button>
        <span class="topic-name">${escapeHTML(topic.name)}</span>${source}
      </li>`;
    }).join("");
    return `<article class="track-card">
      <div class="track-card-head">
        <span class="track-symbol track-symbol-${track.id}" aria-hidden="true">${meta.icon}</span>
        <div class="track-heading-copy"><p class="track-kicker">${meta.label}</p><h3>${escapeHTML(track.title)}</h3></div>
        <span class="track-completion">${percent}%</span>
      </div>
      <p class="track-description">${meta.description}</p>
      <div class="track-progress-copy"><span>TRACK PROGRESS</span><span>${done}/${track.topics.length} complete</span></div>
      <div class="track-progress" role="progressbar" aria-label="${escapeHTML(track.title)} progress" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${track.topics.length}"><span style="width:${percent}%"></span></div>
      <ul class="topic-list">${topicsMarkup}</ul>
    </article>`;
  }).join("");

  trackGrid.innerHTML = cards || '<p class="empty-state">No topics match your search. Try another keyword or status filter.</p>';
  trackGrid.querySelectorAll(".topic-check").forEach((button) => {
    button.addEventListener("click", () => {
      const { topicId } = button.dataset;
      if (completedTopics.has(topicId)) completedTopics.delete(topicId);
      else completedTopics.add(topicId);
      saveCompletedTopics();
      renderTracks();
      updateProgress();
    });
  });
  updateProgress();
}

function formatDate(value) {
  if (!value) return "No commits recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid update timestamp: ${value}`);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderProject(project) {
  document.querySelector("#last-updated").textContent = formatDate(project.generatedAt);
  document.querySelector("#weekly-commits").textContent = project.activity.commitsLast7Days;
  document.querySelector("#tracked-files").textContent = project.repository.trackedFiles;
  document.querySelector("#tracked-uml-assets").textContent = project.repository.umlAssets;
  const list = document.querySelector("#commit-list");
  if (!project.activity.recentCommits.length) {
    list.innerHTML = '<li class="empty-state">No commit history is available yet.</li>';
    return;
  }
  list.innerHTML = project.activity.recentCommits.map((commit) => {
    const href = `https://github.com/Comp-Alex/Software-Design-Lab-Activities/commit/${encodeURIComponent(commit.hash)}`;
    return `<li class="commit-item">
      <span class="commit-marker" aria-hidden="true">↗</span>
      <div class="commit-details"><a class="commit-message" href="${href}" target="_blank" rel="noreferrer">${escapeHTML(commit.message)}</a><span class="commit-meta">${escapeHTML(commit.date)}</span></div>
      <a class="commit-hash" href="${href}" target="_blank" rel="noreferrer">${escapeHTML(commit.hash)}</a>
    </li>`;
  }).join("");
}

async function loadDashboard() {
  try {
    const [tracksResponse, projectResponse] = await Promise.all([
      fetch(TRACKS_URL, { cache: "no-store" }),
      fetch(PROJECT_URL, { cache: "no-store" }),
    ]);
    if (!tracksResponse.ok) throw new Error(`Could not load learning tracks (${tracksResponse.status})`);
    if (!projectResponse.ok) throw new Error(`Could not load project activity (${projectResponse.status})`);
    const [trackData, projectData] = await Promise.all([tracksResponse.json(), projectResponse.json()]);
    if (!Array.isArray(trackData.tracks) || !projectData.activity || !projectData.repository) {
      throw new Error("Dashboard data is missing required fields.");
    }
    tracks = trackData.tracks;
    renderProject(projectData);
    renderTracks();
  } catch (error) {
    trackGrid.innerHTML = '<p class="empty-state">Dashboard data could not be loaded. Serve the repository over HTTP and try again.</p>';
    document.querySelector("#commit-list").innerHTML = '<li class="empty-state">Repository activity could not be loaded.</li>';
    document.querySelector("#last-updated").textContent = "Data unavailable";
    console.error("Dashboard initialization failed:", error);
  }
}

searchInput.addEventListener("input", renderTracks);
filterSelect.addEventListener("change", renderTracks);
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    searchInput.blur();
    renderTracks();
  }
});

loadDashboard();
