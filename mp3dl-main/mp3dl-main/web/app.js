/**
 * MP3DL PRO — Frontend Client Application Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const urlInput = document.getElementById("url-input");
  const fetchBtn = document.getElementById("fetch-btn");
  const pasteBtn = document.getElementById("paste-btn");
  const clearBtn = document.getElementById("clear-btn");
  const openFolderBtn = document.getElementById("open-folder-btn");
  const audioFormatSelect = document.getElementById("global-audio-format");
  
  const alertBox = document.getElementById("alert-box");
  const alertMsg = document.getElementById("alert-message");
  
  const emptyState = document.getElementById("empty-state");
  const playlistView = document.getElementById("playlist-view");
  const searchView = document.getElementById("search-view");
  
  const playlistTitle = document.getElementById("playlist-title");
  const playlistSourceBadge = document.getElementById("playlist-source-badge");
  const playlistSourceIcon = document.getElementById("playlist-source-icon");
  const trackCountSpan = document.getElementById("track-count");
  const selectedCountSpan = document.getElementById("selected-count");
  const trackListBody = document.getElementById("track-list-body");
  
  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  const trackFilterInput = document.getElementById("track-filter-input");
  
  const downloadSelectedBtn = document.getElementById("download-selected-btn");
  const exportTxtBtn = document.getElementById("export-txt-btn");
  const exportJsonBtn = document.getElementById("export-json-btn");
  
  const progressPanel = document.getElementById("download-progress-panel");
  const progressBarFill = document.getElementById("progress-bar-fill");
  const progressTitle = document.getElementById("progress-title");
  const progressSubtitle = document.getElementById("progress-subtitle");
  const statCompleted = document.getElementById("stat-completed");
  const statFailed = document.getElementById("stat-failed");
  const statFolder = document.getElementById("stat-folder");
  const logContent = document.getElementById("log-content");

  // State Management
  let currentPlaylistData = null;
  let extractedTracks = [];
  let progressPollingInterval = null;

  // Initial Setup
  loadDefaultFolder();

  // ── Event Listeners ────────────────────────────────────────────────────────

  urlInput.addEventListener("input", () => {
    clearBtn.style.display = urlInput.value ? "inline-flex" : "none";
  });

  clearBtn.addEventListener("click", () => {
    urlInput.value = "";
    clearBtn.style.display = "none";
    urlInput.focus();
  });

  pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        clearBtn.style.display = "inline-flex";
        triggerFetch();
      }
    } catch (err) {
      showAlert("Could not read clipboard. Please paste manually into the input box.");
    }
  });

  fetchBtn.addEventListener("click", triggerFetch);

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      triggerFetch();
    }
  });

  selectAllCheckbox.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    const checkboxes = trackListBody.querySelectorAll(".track-select-checkbox");
    checkboxes.forEach(cb => cb.checked = isChecked);
    updateSelectedCount();
  });

  trackFilterInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const rows = trackListBody.querySelectorAll("tr");
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(query) ? "" : "none";
    });
  });

  downloadSelectedBtn.addEventListener("click", startBatchDownload);
  exportTxtBtn.addEventListener("click", exportTxtList);
  exportJsonBtn.addEventListener("click", exportJsonList);
  openFolderBtn.addEventListener("click", openDownloadFolder);

  // ── API Actions ────────────────────────────────────────────────────────────

  async function loadDefaultFolder() {
    try {
      const res = await fetch("/api/default-folder");
      const data = await res.json();
      if (data.folder) {
        statFolder.innerText = data.folder;
      }
    } catch (e) {}
  }

  async function triggerFetch() {
    const query = urlInput.value.trim();
    if (!query) {
      showAlert("Please enter a Spotify/YouTube playlist URL or song query.");
      return;
    }

    hideAlert();
    setFetchLoading(true);

    const isUrl = query.startsWith("http://") || query.startsWith("https://");

    if (isUrl) {
      try {
        const res = await fetch("/api/fetch-playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: query }),
        });

        const data = await res.json();
        setFetchLoading(false);

        if (!res.ok || data.error) {
          showAlert(data.error || "Failed to fetch playlist.");
          return;
        }

        renderPlaylistView(data);
      } catch (err) {
        setFetchLoading(false);
        showAlert("Connection error. Ensure the local server is running.");
      }
    } else {
      // Single Song Search
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        const data = await res.json();
        setFetchLoading(false);

        if (!res.ok || data.error) {
          showAlert(data.error || "Search failed.");
          return;
        }

        renderSearchView(data.results || []);
      } catch (err) {
        setFetchLoading(false);
        showAlert("Connection error while searching YouTube.");
      }
    }
  }

  function renderPlaylistView(data) {
    currentPlaylistData = data;
    extractedTracks = data.tracks || [];

    playlistTitle.innerText = data.title || "Extracted Playlist";
    trackCountSpan.innerText = extractedTracks.length;
    
    const source = data.source || "Playlist";
    playlistSourceBadge.innerText = source;

    if (source.toLowerCase().includes("spotify")) {
      playlistSourceIcon.className = "fa-brands fa-spotify";
      playlistSourceIcon.style.color = "var(--spotify-green)";
      playlistSourceBadge.style.background = "rgba(29, 185, 84, 0.15)";
      playlistSourceBadge.style.color = "var(--spotify-green)";
    } else {
      playlistSourceIcon.className = "fa-brands fa-youtube";
      playlistSourceIcon.style.color = "var(--youtube-red)";
      playlistSourceBadge.style.background = "rgba(239, 68, 68, 0.15)";
      playlistSourceBadge.style.color = "#fca5a5";
    }

    // Populate Table
    trackListBody.innerHTML = "";
    extractedTracks.forEach((t, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <label class="custom-checkbox">
            <input type="checkbox" class="track-select-checkbox" data-index="${i}" checked>
            <span class="checkmark"></span>
          </label>
        </td>
        <td class="track-artist">${i + 1}</td>
        <td class="track-title">${escapeHtml(t.title || t.query)}</td>
        <td class="track-artist">${escapeHtml(t.artist || "Unknown Artist")}</td>
        <td class="text-right">
          <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px;" onclick="downloadSingleTrack('${escapeJs(t.query)}')">
            <i class="fa-solid fa-download"></i> DL
          </button>
        </td>
      `;
      trackListBody.appendChild(tr);
    });

    // Attach row checkbox event listeners
    trackListBody.querySelectorAll(".track-select-checkbox").forEach(cb => {
      cb.addEventListener("change", updateSelectedCount);
    });

    selectAllCheckbox.checked = true;
    updateSelectedCount();

    emptyState.style.display = "none";
    searchView.style.display = "none";
    playlistView.style.display = "block";
  }

  function renderSearchView(results) {
    if (!results.length) {
      showAlert("No YouTube search results found.");
      return;
    }

    const listContainer = document.getElementById("search-results-list");
    listContainer.innerHTML = "";

    results.forEach(r => {
      const card = document.createElement("div");
      card.className = "search-result-card glass-panel";
      card.style.padding = "16px";
      card.style.marginBottom = "12px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";

      card.innerHTML = `
        <div>
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(r.title)}</h4>
          <p style="font-size: 13px; color: var(--text-muted);">
            Uploader: ${escapeHtml(r.uploader)} | Duration: ${r.duration}
          </p>
        </div>
        <button class="btn btn-primary" onclick="downloadSingleTrack('${escapeJs(r.title)}')">
          <i class="fa-solid fa-download"></i> Download
        </button>
      `;
      listContainer.appendChild(card);
    });

    emptyState.style.display = "none";
    playlistView.style.display = "none";
    searchView.style.display = "block";
  }

  function updateSelectedCount() {
    const selected = trackListBody.querySelectorAll(".track-select-checkbox:checked");
    selectedCountSpan.innerText = selected.length;
  }

  async function startBatchDownload() {
    const selectedCheckboxes = trackListBody.querySelectorAll(".track-select-checkbox:checked");
    if (!selectedCheckboxes.length) {
      showAlert("Please select at least one song to download.");
      return;
    }

    const selectedTracks = Array.from(selectedCheckboxes).map(cb => {
      const idx = parseInt(cb.getAttribute("data-index"));
      return extractedTracks[idx];
    });

    try {
      const res = await fetch("/api/download-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: selectedTracks,
          playlist_title: currentPlaylistData ? currentPlaylistData.title : "Downloads",
          audio_format: audioFormatSelect ? audioFormatSelect.value : "mp3"
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        showAlert(data.error || "Failed to start download task.");
        return;
      }

      progressPanel.style.display = "block";
      startProgressPolling();
    } catch (err) {
      showAlert("Could not send download request to server.");
    }
  }

  window.downloadSingleTrack = function(query) {
    fetch("/api/download-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: [{ query: query }],
        audio_format: audioFormatSelect ? audioFormatSelect.value : "mp3"
      })
    }).then(r => r.json()).then(data => {
      if (data.error) {
        showAlert(data.error);
      } else {
        progressPanel.style.display = "block";
        startProgressPolling();
      }
    });
  };

  function startProgressPolling() {
    if (progressPollingInterval) clearInterval(progressPollingInterval);

    progressPollingInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/progress");
        const state = await res.json();

        progressTitle.innerText = state.active ? `Downloading: ${state.current_track || 'Initializing...'}` : "Download Task Finished";
        progressSubtitle.innerText = `Track ${state.current_index} of ${state.total_tracks}`;
        statCompleted.innerText = state.completed;
        statFailed.innerText = state.failed;
        statFolder.innerText = state.download_dir;

        const percent = state.total_tracks > 0 ? Math.round((state.current_index / state.total_tracks) * 100) : 0;
        progressBarFill.style.width = `${percent}%`;

        if (state.logs && state.logs.length) {
          logContent.innerText = state.logs.join("\n");
          logContent.scrollTop = logContent.scrollHeight;
        }

        if (!state.active && state.status === "complete") {
          clearInterval(progressPollingInterval);
          progressPollingInterval = null;
        }
      } catch (e) {}
    }, 1000);
  }

  async function openDownloadFolder() {
    try {
      await fetch("/api/open-folder", { method: "POST" });
    } catch (e) {}
  }

  function exportTxtList() {
    if (!currentPlaylistData) return;
    const lines = [`# Playlist: ${currentPlaylistData.title}`, `# Total Tracks: ${extractedTracks.length}`, ""];
    extractedTracks.forEach(t => lines.push(t.query));
    
    downloadFile(`${slugify(currentPlaylistData.title)}.txt`, lines.join("\n"), "text/plain");
  }

  function exportJsonList() {
    if (!currentPlaylistData) return;
    const jsonStr = JSON.stringify(currentPlaylistData, null, 2);
    downloadFile(`${slugify(currentPlaylistData.title)}.json`, jsonStr, "application/json");
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Helpers
  window.loadSample = function(sampleUrl) {
    urlInput.value = sampleUrl;
    clearBtn.style.display = "inline-flex";
    triggerFetch();
  };

  function setFetchLoading(isLoading) {
    const btnText = fetchBtn.querySelector(".btn-text");
    const spinner = fetchBtn.querySelector(".spinner");
    if (isLoading) {
      btnText.style.display = "none";
      spinner.style.display = "inline-block";
      fetchBtn.disabled = true;
    } else {
      btnText.style.display = "inline-block";
      spinner.style.display = "none";
      fetchBtn.disabled = false;
    }
  }

  function showAlert(msg) {
    alertMsg.innerText = msg;
    alertBox.style.display = "flex";
  }

  window.hideAlert = function() {
    alertBox.style.display = "none";
  };

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeJs(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  function slugify(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "playlist";
  }
});
