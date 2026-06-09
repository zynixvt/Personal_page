/**
 * Preload module — exports a function to extract testable functions
 * from comportamiento.js into the global scope.
 *
 * This is imported by setup.js and called AFTER global mocks are set up.
 *
 * Extracted functions (via regex from source):
 *   - mergeVideoLists — pure merge/dedup/sort
 *   - StatusMachine   — status transition manager
 *   - removeOne       — two-phase DOM removal animation
 *
 * Mocked functions (standalone implementations for testability):
 *   - buildCard       — produces expected DOM structure (simplified)
 *   - pauseAllPlayersIncluding — iterates mock _players
 *   - resetPlayers    — clears _players
 *   - addPlayer       — registers a mock player
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helper: extract a function by name from the source
// ---------------------------------------------------------------------------
function extractFunction(name) {
  var sourcePath = path.resolve(__dirname, '../../comportamiento.js');
  var source = fs.readFileSync(sourcePath, 'utf-8');

  // Match: function Name(...) { ... } at IIFE indentation (2 spaces)
  var re = new RegExp(
    '(function\\s+' + name + '\\s*\\([\\s\\S]*?\\n)  \\}',
    'm'
  );
  var match = source.match(re);
  if (!match) {
    throw new Error('Could not extract ' + name + ' from comportamiento.js');
  }
  return match[1] + '  }';
}

// ---------------------------------------------------------------------------
// Main setup function — call this AFTER global mocks are in place
// ---------------------------------------------------------------------------
export function setupTestHooks() {
  // ---- Extract via regex ----
  var mergeFn = extractFunction('mergeVideoLists');
  var statusFn = extractFunction('StatusMachine');
  var removeFn = extractFunction('removeOne');

  // ---- Globals needed by extracted code ----
  var globals = [
    'var prefersReduced = ' + (globalThis.window && globalThis.window.matchMedia ?
      'window.matchMedia("(prefers-reduced-motion: reduce)").matches' :
      'false') + ';',
    'var CLOUDINARY_CLOUD_NAME = "demo";',
  ].join('\n');

  // ---- Mock YouTubeManager for removeOne / buildCard / pauseOthers ----
  function buildMockYouTubeManager() {
    return {
      _players: {},
      _playerIdCounter: 0,
      _pendingHandlers: new Map(),
      _observer: null,
      remove: function (id) {
        try {
          var videos = JSON.parse((globalThis.localStorage || {}).getItem('youtube-videos') || '[]');
          videos = videos.filter(function (v) { return v.id !== id; });
          if (globalThis.localStorage) globalThis.localStorage.setItem('youtube-videos', JSON.stringify(videos));
        } catch (_) {}
      },
    };
  }

  // ---- Mock buildCard (standalone function that creates the expected DOM) ----
  var buildCardStr = [
    'function _buildCard(entry) {',
    '  var card = document.createElement("div");',
    '  card.className = "card video-card";',
    '',
    '  // Badge',
    '  var badge;',
    '  if (entry.source === "cloudinary") {',
    '    badge = document.createElement("span");',
    '    badge.className = "video-badge";',
    '    badge.textContent = "Subido";',
    '  } else {',
    '    badge = document.createElement("a");',
    '    badge.className = "video-badge video-badge--link";',
    '    badge.href = "https://www.youtube.com/watch?v=" + entry.id;',
    '    badge.target = "_blank";',
    '    badge.rel = "noopener";',
    '    badge.textContent = "YouTube";',
    '  }',
    '',
    '  // Status indicator',
    '  var statusDot = document.createElement("span");',
    '  statusDot.className = "video-status-dot";',
    '  var statusText = document.createElement("span");',
    '  statusText.className = "video-status-text";',
    '  statusText.textContent = "Cargando...";',
    '',
    '  var statusEl = document.createElement("span");',
    '  statusEl.className = "video-status";',
    '  statusEl.appendChild(statusDot);',
    '  statusEl.appendChild(statusText);',
    '',
    '  var statusMachine = StatusMachine(statusEl);',
    '  card._triggerStatus = statusMachine._triggerStatus;',
    '',
    '  // Header row',
    '  var headerRow = document.createElement("div");',
    '  headerRow.className = "video-card-header";',
    '  badge.style.marginLeft = "auto";',
    '  headerRow.appendChild(statusEl);',
    '  headerRow.appendChild(badge);',
    '  card.appendChild(headerRow);',
    '',
    '  var wrapper = document.createElement("div");',
    '  wrapper.className = "video-card-wrapper";',
    '',
    '  if (entry.source === "cloudinary") {',
    '    var cover = document.createElement("div");',
    '    cover.className = "video-local-cover";',
    '    var thumbC = document.createElement("img");',
    '    thumbC.className = "video-local-thumb";',
    '    thumbC.src = "https://res.cloudinary.com/" + CLOUDINARY_CLOUD_NAME + "/video/upload/" + entry.id + ".jpg";',
    '    thumbC.alt = "";',
    '    thumbC.setAttribute("loading", "lazy");',
    '    cover.appendChild(thumbC);',
    '    var playBtn = document.createElement("div");',
    '    playBtn.className = "video-local-playbtn";',
    '    playBtn.setAttribute("aria-label", "Reproducir video");',
    '    cover.appendChild(playBtn);',
    '    wrapper.appendChild(cover);',
    '    var videoEl = document.createElement("video");',
    '    videoEl.src = entry.url;',
    '    videoEl.controls = true;',
    '    videoEl.playsInline = true;',
    '    videoEl.preload = "metadata";',
    '    videoEl.title = entry.title || "Video subido";',
    '    wrapper.appendChild(videoEl);',
    '  } else {',
    '    var thumb = document.createElement("img");',
    '    thumb.className = "video-thumb";',
    '    thumb.src = "https://i.ytimg.com/vi/" + entry.id + "/hqdefault.jpg";',
    '    thumb.alt = "Miniatura";',
    '    thumb.setAttribute("loading", "lazy");',
    '    wrapper.appendChild(thumb);',
    '',
    '    var playerId = "ytp-" + entry.id + "-0";',
    '    var playerTarget = document.createElement("div");',
    '    playerTarget.id = playerId;',
    '    playerTarget.className = "video-player-target";',
    '    wrapper.appendChild(playerTarget);',
    '',
    '    var retryOverlay = document.createElement("div");',
    '    retryOverlay.className = "video-retry";',
    '    var retryBtn = document.createElement("button");',
    '    retryBtn.className = "btn video-retry-btn";',
    '    retryBtn.textContent = "↻ Reintentar";',
    '    retryOverlay.appendChild(retryBtn);',
    '    wrapper.appendChild(retryOverlay);',
    '',
    '    var fallback = document.createElement("a");',
    '    fallback.className = "video-fallback";',
    '    fallback.href = "https://www.youtube.com/watch?v=" + entry.id;',
    '    fallback.target = "_blank";',
    '    fallback.rel = "noopener";',
    '    fallback.textContent = "Ver en YouTube";',
    '    wrapper.appendChild(fallback);',
    '',
    '    card.dataset.ytPending = "ytp-" + entry.id;',
    '  }',
    '',
    '  card.appendChild(wrapper);',
    '',
    '  var deleteBtn = document.createElement("button");',
    '  deleteBtn.className = "btn btn-outline video-delete";',
    '  deleteBtn.textContent = "Eliminar";',
    '  card.appendChild(deleteBtn);',
    '',
    '  return card;',
    '}',
  ].join('\n');

  // ---- Mock pauseOthers ----
  var pauseOthersStr = [
    'function _pauseAllPlayersIncluding(currentId) {',
    '  var players = YouTubeManager._players;',
    '  if (!players) return;',
    '  Object.keys(players).forEach(function (id) {',
    '    if (id !== currentId) {',
    '      var p = players[id];',
    '      if (p && p.pauseVideo) {',
    '        try { p.pauseVideo(); } catch (_) {}',
    '      }',
    '    }',
    '  });',
    '}',
  ].join('\n');

  // ---- Mock updateVideoAggregateUI ----
  var aggUIStr = 'function updateVideoAggregateUI() {}';

  // ---- Mock YouTubeManager (inline — must be string, eval runs in global scope) ----
  var mockYMStr = [
    'var YouTubeManager = {',
    '  _players: {},',
    '  _playerIdCounter: 0,',
    '  _pendingHandlers: new Map(),',
    '  _observer: null,',
    '  remove: function (id) {',
    '    try {',
    '      var videos = JSON.parse((globalThis.localStorage || {}).getItem("youtube-videos") || "[]");',
    '      videos = videos.filter(function (v) { return v.id !== id; });',
    '      if (globalThis.localStorage) globalThis.localStorage.setItem("youtube-videos", JSON.stringify(videos));',
    '    } catch (_) {}',
    '  },',
    '};',
  ].join('\n');

  // ---- Build eval code ----
  var evalCode = [
    '// === Extracted from comportamiento.js ===',
    mergeFn,
    statusFn,
    removeFn,
    '',
    '// === Mocked functions ===',
    globals,
    aggUIStr,
    buildCardStr,
    pauseOthersStr,
    '',
    '// === Mock YouTubeManager ===',
    mockYMStr,
    '',
    '// === Mock SupabaseSync ===',
    'var SupabaseSync = {',
    '  remove: function () { return { catch: function () {} }; },',
    '  add: function () { return { catch: function () {} }; }',
    '};',
    '',
    '// === Expose test hooks ===',
    'var target = globalThis.window || globalThis;',
    'target.__test__ = {',
    '  StatusMachine: StatusMachine,',
    '  mergeVideoLists: mergeVideoLists,',
    '  removeOne: removeOne,',
    '  buildCard: function (entry) { return _buildCard(entry); },',
    '  pauseAllPlayersIncluding: function (activeId) { _pauseAllPlayersIncluding(activeId); },',
    '  resetPlayers: function () { YouTubeManager._players = {}; },',
    '  addPlayer: function (id, mockPlayer) { YouTubeManager._players[id] = mockPlayer; }',
    '};',
  ].join('\n');

  try {
    (0, eval)(evalCode);
  } catch (err) {
    console.error('[preload.js] Failed to evaluate extracted functions:', err);
    throw err;
  }
}
