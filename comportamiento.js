(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ======================================================================
  // PanelController — hash routing, focus trapping, aria management
  // ======================================================================
  const PanelController = {
    panels: new Map(),
    activePanel: null,
    previousFocus: null,

    init: function () {
      const panelEls = document.querySelectorAll('.panel');
      panelEls.forEach(function (el) {
        PanelController.panels.set(el.id, el);
      });

      window.addEventListener('hashchange', PanelController._onHashChange);

      // Dashboard home buttons (data-panel attribute)
      document.querySelectorAll('[data-panel]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          // Let the default link behaviour handle hash change,
          // but we need to track focus source for restoration
          PanelController.previousFocus = btn;
        });
      });

      // Panel back buttons
      document.querySelectorAll('.panel-back').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          PanelController.close();
        });
      });

      // Escape key
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && PanelController.activePanel) {
          e.preventDefault();
          PanelController.close();
        }
      });

      // Focus trapping
      document.addEventListener('keydown', PanelController._trapFocus);

      // Handle initial hash
      if (window.location.hash) {
        PanelController._openFromHash(window.location.hash);
      }
    },

    _onHashChange: function (e) {
      PanelController._openFromHash(window.location.hash);
    },

    _openFromHash: function (hash) {
      var panelId = hash.replace('#', '');
      if (!panelId) {
        PanelController.close();
        return;
      }
      if (PanelController.panels.has(panelId)) {
        PanelController.open(panelId);
      } else {
        PanelController.close();
      }
    },

    open: function (panelId) {
      // Close current panel if any
      if (PanelController.activePanel) {
        var oldPanel = PanelController.panels.get(PanelController.activePanel);
        if (oldPanel) {
          oldPanel.classList.remove('active');
          oldPanel.setAttribute('aria-hidden', 'true');
        }
      }

      var panel = PanelController.panels.get(panelId);
      if (!panel) return;

      PanelController.activePanel = panelId;

      panel.classList.add('active');
      panel.setAttribute('aria-hidden', 'false');

      // Hide home
      var home = document.getElementById('dashboard-home');
      if (home) home.setAttribute('aria-hidden', 'true');

      // Pause particles
      ParticleSystem.pause();

      // Focus back button
      var backBtn = panel.querySelector('.panel-back');
      if (backBtn) {
        requestAnimationFrame(function () {
          backBtn.focus();
        });
      }

      // Animación secuencial para videos (después de que el panel termine de entrar)
      if (panelId === 'videos') {
        // Timing:
        //   T=0:    panel empieza a entrar (350ms transition)
        //   T=650:  form card anima (panel in + 0.3s wait)
        //   T=1050: form card termina (0.4s duration)
        //   T=1350: videos visibles (≥50%) animan (form done + 0.3s wait)

        // Desconectar observers: si quedaran activos, dispararían al abrir
        // el panel y agregarían la clase de animación antes de tiempo.
        // Se reconectan en animateEntries (vía setupScrollOptimizer).
        if (YouTubeManager._viewportObserver) YouTubeManager._viewportObserver.disconnect();
        if (YouTubeManager._preloadObserver) YouTubeManager._preloadObserver.disconnect();
        if (YouTubeManager._maintenanceObserver) YouTubeManager._maintenanceObserver.disconnect();

        // Reset form card para re-open
        var formCard = document.querySelector('.video-form-card');
        if (formCard) {
          formCard.classList.remove('video-form-card--enter');
        }

        // Reset video cards para re-open
        document.querySelectorAll('#video-list .video-card').forEach(function (c) {
          c.classList.remove('video-card--enter');
          c._animated = false;
        });

        // 1) Form card animation: T=650ms (panel in + 0.3s)
        setTimeout(function () {
          if (formCard) {
            // Force reflow: garantiza re-trigger de la animación en re-open
            void formCard.offsetWidth;
            formCard.classList.add('video-form-card--enter');
          }
        }, 500);

        // 2) Videos animation: T=1050ms (form done + 0.3s)
        //    animateEntries internamente filtra por ≥50% de visibilidad
        setTimeout(function () {
          YouTubeManager.animateEntries();
        }, 1050);
      }

      // Staggered entrance for list items
      setTimeout(function () {
        if (panelId === 'fnf') {
          document.querySelectorAll('.musica-lista a').forEach(function (el, i) {
            el.style.setProperty('--i', i);
            el.classList.add('slide-in-up');
          });
        }
        if (panelId === 'avisos') {
          document.querySelectorAll('#proximos li, .comentario-item').forEach(function (el, i) {
            el.style.setProperty('--i', i);
            el.classList.add('slide-in-up');
          });
        }
      }, 400);
    },

    close: function () {
      if (!PanelController.activePanel) return;

      // Disconnect observers when closing videos panel (reconnected on next open)
      if (PanelController.activePanel === 'videos') {
        if (YouTubeManager._viewportObserver) YouTubeManager._viewportObserver.disconnect();
        if (YouTubeManager._preloadObserver) YouTubeManager._preloadObserver.disconnect();
        if (YouTubeManager._maintenanceObserver) YouTubeManager._maintenanceObserver.disconnect();
        YouTubeManager._viewportObserver = null;
        YouTubeManager._preloadObserver = null;
        YouTubeManager._maintenanceObserver = null;
      }

      var panel = PanelController.panels.get(PanelController.activePanel);
      if (panel) {
        panel.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
      }

      PanelController.activePanel = null;

      // Show home
      var home = document.getElementById('dashboard-home');
      if (home) home.setAttribute('aria-hidden', 'false');

      // Resume particles
      ParticleSystem.resume();

      // Pausar videos al salir del panel
      YouTubeManager.pauseAll();

      // Clear hash without triggering hashchange
      if (window.location.hash) {
        history.pushState(null, '', window.location.pathname + window.location.search);
      }

      // Restore focus
      if (PanelController.previousFocus) {
        PanelController.previousFocus.focus();
        PanelController.previousFocus = null;
      } else {
        var firstBtn = document.querySelector('[data-panel]');
        if (firstBtn) firstBtn.focus();
      }
    },

    _trapFocus: function (e) {
      if (e.key !== 'Tab') return;
      if (!PanelController.activePanel) return;

      var panel = PanelController.panels.get(PanelController.activePanel);
      if (!panel) return;

      var focusable = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  // ======================================================================
  // Configuration — Cloudinary + Supabase (completar cuando tengas cuentas)
  // ======================================================================
  var VIDEO_STORAGE_KEY = 'youtube-videos';
  var MAX_VIDEOS = 100;
  var WARN_AT_VIDEOS = 50;
  var EXISTING_IDS = ['sYuKxwo-7Sw', 'kqejYrjVuNk', 'gg2kxw2qOPs'];

  // Cloudinary (crear upload preset unsigned antes de activar)
  // 1. Ir a cloudinary.com/console/settings/upload
  // 2. Sección "Upload presets" → "Add upload preset"
  // 3. Modo: Unsigned, Nombre: mis_videos
  // 4. Copiar el nombre del preset abajo
  var CLOUDINARY_CLOUD_NAME = 'dzso3grs1';
  var CLOUDINARY_UPLOAD_PRESET = 'Vid_data_test';
  var MAX_FILE_SIZE_MB = 50;

  // Supabase
  var SUPABASE_URL = 'https://oilccvjtbppwfylpdpyb.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_Dt3veOsdNiWwvNRScoy-RQ_uHWpVtnx';

  // ======================================================================
  // SupabaseSync — shared video storage via Supabase REST API
  // ======================================================================

  var SupabaseSync = {
    _enabled: false,
    _baseUrl: '',
    _headers: {},

    init: function () {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
      this._enabled = true;
      this._baseUrl = SUPABASE_URL + '/rest/v1/videos';
      this._headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      };
    },

    fetchAll: function () {
      if (!this._enabled) return Promise.reject('SupabaseSync not configured');
      return fetch(this._baseUrl + '?select=video_id,source,url,title&order=created_at.asc', {
        headers: this._headers
      }).then(function (res) {
        if (!res.ok) throw new Error('Supabase fetch error: ' + res.status);
        return res.json();
      }).then(function (rows) {
        return rows.map(function (r) {
          var entry = {
            id: r.video_id,
            source: r.source || 'youtube',
            addedAt: new Date().toISOString()
          };
          if (r.title) entry.title = r.title;
          if (r.url) entry.url = r.url;
          return entry;
        });
      });
    },

    add: function (video) {
      if (!this._enabled) return Promise.reject();
      return fetch(this._baseUrl, {
        method: 'POST',
        headers: this._headers,
        body: JSON.stringify({
          video_id: video.id,
          source: video.source || 'youtube',
          url: video.url || '',
          title: video.title || ''
        })
      }).then(function (res) {
        if (!res.ok && res.status !== 409) throw new Error('Supabase insert error: ' + res.status);
        // 409 = already exists (unique constraint), that's fine
      });
    },

    remove: function (videoId) {
      if (!this._enabled) return Promise.reject();
      return fetch(this._baseUrl + '?video_id=eq.' + encodeURIComponent(videoId), {
        method: 'DELETE',
        headers: this._headers
      }).then(function (res) {
        if (!res.ok) throw new Error('Supabase delete error: ' + res.status);
      });
    },

    get enabled() { return this._enabled; }
  };

  // Merge Supabase + localStorage videos by id, dedup, Supabase wins on conflict
  function mergeVideoLists(supabaseVideos, localVideos) {
    var map = {};
    localVideos.forEach(function (v) { map[v.id] = v; });
    supabaseVideos.forEach(function (v) { map[v.id] = v; }); // Supabase overwrites
    return Object.values(map).sort(function (a, b) {
      return new Date(b.addedAt) - new Date(a.addedAt);
    });
  }

  // ======================================================================
  // StatusMachine — status indicator with loading/ready/error/hide transitions
  // Extracted from _buildCard closure so it can be unit-tested.
  // Accepts the .video-status container element; finds .video-status-dot
  // and .video-status-text children via querySelector.
  // ======================================================================

  function StatusMachine(element) {
    var dot = element.querySelector('.video-status-dot');
    var text = element.querySelector('.video-status-text');
    var _state = 'loading';
    var _statusTimeoutId;

    // Apply initial loading state synchronously (no animation)
    dot.className = 'video-status-dot status-loading';
    text.className = 'video-status-text status-loading';
    text.textContent = 'Cargando...';

    function setState(state, fast) {
      clearTimeout(_statusTimeoutId);
      var prevState = _state || 'loading';
      _state = state;
      var delay = fast ? 100 : 300;

      if (state === 'hide') {
        text.className = 'video-status-text status-slide-out';
        if (prevState === 'ready') text.classList.add('status-ready');
        else if (prevState === 'error') text.classList.add('status-error');
        return;
      }

      // Slide out current text WITH its color preserved
      text.className = 'video-status-text status-slide-out';
      if (prevState === 'ready') text.classList.add('status-ready');
      else if (prevState === 'error') text.classList.add('status-error');

      _statusTimeoutId = setTimeout(function () {
        dot.className = 'video-status-dot';
        text.className = 'video-status-text';
        if (state === 'ready') {
          dot.classList.add('status-ready');
          text.classList.add('status-ready');
          text.textContent = 'Listo';
          text.classList.add('status-slide-in');

          // Auto-hide "Listo" after 2s — KEEP green while sliding out
          _statusTimeoutId = setTimeout(function () {
            text.className = 'video-status-text status-slide-out';
            text.classList.add('status-ready');
          }, 2000);
        } else if (state === 'error') {
          dot.classList.add('status-error');
          text.classList.add('status-error');
          text.textContent = 'Error de carga';
          text.classList.add('status-slide-in');
        } else {
          // loading
          dot.classList.add('status-loading');
          text.classList.add('status-loading');
          text.textContent = 'Cargando...';
          text.classList.add('status-slide-in');
        }
      }, delay);
    }

    function _triggerStatus() {
      setState(_state || 'loading', true);
    }

    return {
      setState: setState,
      _triggerStatus: _triggerStatus,
      el: element
    };
  }

  // ======================================================================
  // VideoManager — YouTube + Cloudinary, localStorage CRUD, Supabase sync
  // ======================================================================

  var YouTubeManager = {
    extractId: function (url) {
      try {
        var u = new URL(url);
        // youtube.com/watch?v=ID
        if (u.hostname.includes('youtube.com') && u.pathname === '/watch') {
          return u.searchParams.get('v');
        }
        // youtube.com/embed/ID or youtube.com/shorts/ID
        if (u.hostname.includes('youtube.com')) {
          var m = u.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
          return m ? m[1] : null;
        }
        // youtu.be/ID
        if (u.hostname === 'youtu.be') {
          var m2 = u.pathname.match(/^\/([a-zA-Z0-9_-]{11})/);
          return m2 ? m2[1] : null;
        }
        return null;
      } catch (_) {
        return null;
      }
    },

    add: function (url, title) {
      var id = YouTubeManager.extractId(url);
      if (!id) return 'invalid';

      var videos = YouTubeManager.getAll();
      // Check duplicates
      var exists = videos.some(function (v) { return v.id === id; });
      if (exists) return 'duplicate';

      // Cap at MAX_VIDEOS
      if (videos.length >= MAX_VIDEOS) return 'full';

      var video = {
        id: id,
        source: 'youtube',
        title: title || '',
        addedAt: new Date().toISOString()
      };
      videos.push(video);
      localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos));

      // Sync to Supabase (fire-and-forget)
      SupabaseSync.add(video).catch(function () {});
      return 'added';
    },

    addCloudinary: function (url, publicId, title) {
      var videos = YouTubeManager.getAll();
      // Check duplicates by publicId
      var exists = videos.some(function (v) { return v.id === publicId; });
      if (exists) return 'duplicate';

      // Cap at MAX_VIDEOS
      if (videos.length >= MAX_VIDEOS) return 'full';

      var video = {
        id: publicId,
        source: 'cloudinary',
        url: url,
        title: title || 'Video subido',
        addedAt: new Date().toISOString()
      };
      videos.push(video);
      localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos));

      // Sync to Supabase (fire-and-forget)
      SupabaseSync.add(video).catch(function () {});
      return 'added';
    },

    isNearCapacity: function () {
      return YouTubeManager.getAll().length >= WARN_AT_VIDEOS;
    },

    getCount: function () {
      return YouTubeManager.getAll().length;
    },

    remove: function (id) {
      var videos = YouTubeManager.getAll().filter(function (v) { return v.id !== id; });
      localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos));
      SupabaseSync.remove(id).catch(function () {});
    },

    getAll: function () {
      try {
        var data = JSON.parse(localStorage.getItem(VIDEO_STORAGE_KEY) || '[]');
        // Backward compat: entradas viejas sin source son YouTube
        data.forEach(function (v) {
          if (!v.source) v.source = 'youtube';
        });
        // Sort newest first
        data.sort(function (a, b) {
          return new Date(b.addedAt) - new Date(a.addedAt);
        });
        return data;
      } catch (_) {
        return [];
      }
    },

    migrateExisting: function () {
      var existing = YouTubeManager.getAll();
      if (existing.length > 0) return; // Already has data

      var entries = EXISTING_IDS.map(function (id) {
        return {
          id: id,
          source: 'youtube',
          title: '',
          addedAt: new Date().toISOString()
        };
      });
      localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(entries));
    },

    // Add a raw video entry (used by cross-device sync — skips URL parsing)
    _addEntry: function (entry) {
      var videos = YouTubeManager.getAll();
      var exists = videos.some(function (v) { return v.id === entry.id; });
      if (exists) return 'duplicate';
      if (videos.length >= MAX_VIDEOS) return 'full';
      videos.push(entry);
      localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos));
      return 'added';
    },

    // Colección de players YT.Player (entry.id → YT.Player)
    _players: {},
    _playerIdCounter: 0,
    _pendingHandlers: new Map(),
    _initialRender: false,

    _updateCapacityWarning: function (container) {
      if (!container || !container.querySelector) return;
      var existingWarn = container.querySelector('.video-capacity-warn');
      if (YouTubeManager.isNearCapacity()) {
        var count = YouTubeManager.getCount();
        if (!existingWarn) {
          var warn = document.createElement('p');
          warn.className = 'video-capacity-warn';
          warn.textContent = '\u26A0\uFE0F Ten\u00E9s ' + count + ' de ' + MAX_VIDEOS + ' videos guardados.';
          container.insertBefore(warn, container.firstChild);
        } else {
          existingWarn.textContent = '\u26A0\uFE0F Ten\u00E9s ' + count + ' de ' + MAX_VIDEOS + ' videos guardados.';
        }
      } else if (existingWarn && existingWarn.parentNode) {
        existingWarn.parentNode.removeChild(existingWarn);
      }
    },

    _createPlayer: function (id, targetDiv, handlers) {
      // Destruir player existente para este id
      if (YouTubeManager._players[id]) {
        try { YouTubeManager._players[id].destroy(); } catch (_) {}
        delete YouTubeManager._players[id];
      }

      function init() {
        if (typeof YT === 'undefined' || !YT.Player) return false;
        if (YouTubeManager._players[id]) return true;

        // Si el target fue removido del DOM (render() entre medio), saltear
        if (!document.getElementById(targetDiv.id)) return true;

        // Si la card salió de la zona de precarga antes de que YT API
        // estuviera lista, no crear el player ahora (se creará cuando
        // la card vuelva a entrar via _startPreload).
        if (YouTubeManager._cancelledTargets && YouTubeManager._cancelledTargets.has(targetDiv.id)) {
          YouTubeManager._cancelledTargets.delete(targetDiv.id);
          return true;
        }

        try {
          var player = new YT.Player(targetDiv.id, {
            videoId: id,
            width: '100%',
            height: '100%',
            playerVars: {
              playsinline: 1,
              rel: 0
            },
            events: {
              onReady: handlers.onReady || function () {},
              onStateChange: handlers.onStateChange || function () {},
              onError: handlers.onError || function () {}
            }
          });
          YouTubeManager._players[id] = player;
        } catch (e) {
          return false;
        }
        return true;
      }

      if (!init()) {
        // API aún no lista
        if (!window._ytPendingPlayers) window._ytPendingPlayers = [];
        window._ytPendingPlayers.push(init);

        // Polling fallback por si onYouTubeIframeAPIReady nunca se dispara
        if (!window._ytPollTimer) {
          window._ytPollTimer = setInterval(function () {
            if (typeof YT !== 'undefined' && YT.Player) {
              clearInterval(window._ytPollTimer);
              window._ytPollTimer = null;
              if (window._ytPendingPlayers) {
                var q = window._ytPendingPlayers.slice();
                window._ytPendingPlayers = [];
                q.forEach(function (fn) { fn(); });
              }
            }
          }, 500);
          setTimeout(function () {
            if (window._ytPollTimer) {
              clearInterval(window._ytPollTimer);
              window._ytPollTimer = null;
            }
          }, 60000);
        }
      }
    },

    _pauseOthers: function (currentId, excludeVideoEl) {
      Object.keys(YouTubeManager._players).forEach(function (id) {
        if (id !== currentId) {
          var p = YouTubeManager._players[id];
          if (p && p.pauseVideo) {
            try { p.pauseVideo(); } catch (_) {}
          }
        }
      });
      // También pausar videos de Cloudinary (excepto el que excluimos)
      document.querySelectorAll('#video-list .video-card video').forEach(function (v) {
        if (v === excludeVideoEl) return;
        try { v.pause(); } catch (_) {}
      });
    },

    _destroyPlayers: function () {
      Object.keys(YouTubeManager._players).forEach(function (id) {
        var p = YouTubeManager._players[id];
        if (p && p.destroy) {
          try { p.destroy(); } catch (_) {}
        }
      });
      YouTubeManager._players = {};
    },

    _buildCard: function (entry) {
      var card = document.createElement('div');
      card.className = 'card video-card';
      card.dataset.videoId = entry.id;

      // Badge de origen + status indicator en un header row
      var badge;
      if (entry.source === 'cloudinary') {
        badge = document.createElement('span');
        badge.className = 'video-badge';
        badge.textContent = 'Subido';
      } else {
        badge = document.createElement('a');
        badge.className = 'video-badge video-badge--link';
        badge.href = 'https://www.youtube.com/watch?v=' + entry.id;
        badge.target = '_blank';
        badge.rel = 'noopener';
        badge.textContent = 'YouTube';
      }

      // Status indicator (dot + texto deslizante)
      var statusDot = document.createElement('span');
      statusDot.className = 'video-status-dot';
      var statusText = document.createElement('span');
      statusText.className = 'video-status-text';
      statusText.textContent = 'Cargando...';

      var statusEl = document.createElement('span');
      statusEl.className = 'video-status';
      statusEl.appendChild(statusDot);
      statusEl.appendChild(statusText);

      var statusMachine = StatusMachine(statusEl);

      // Re-trigger status animation based on current state (for scroll re-entry)
      card._triggerStatus = statusMachine._triggerStatus;

      // Header row: status izq | badge der
      var headerRow = document.createElement('div');
      headerRow.className = 'video-card-header';
      badge.style.marginLeft = 'auto';
      headerRow.appendChild(statusEl);
      headerRow.appendChild(badge);
      card.appendChild(headerRow);

      var wrapper = document.createElement('div');
      wrapper.className = 'video-card-wrapper';

      if (entry.source === 'cloudinary') {
        // Cover: thumbnail + botón play estilo YouTube
        var cover = document.createElement('div');
        cover.className = 'video-local-cover';

        // Thumbnail desde Cloudinary (frame del video, como hqdefault.jpg)
        var thumbC = document.createElement('img');
        thumbC.className = 'video-local-thumb';
        thumbC.src = 'https://res.cloudinary.com/' + CLOUDINARY_CLOUD_NAME + '/video/upload/' + entry.id + '.jpg';
        thumbC.alt = '';
        thumbC.setAttribute('loading', 'lazy');
        cover.appendChild(thumbC);

        // Botón play estilo YouTube: centro negro, resto amarillo
        var playBtn = document.createElement('div');
        playBtn.className = 'video-local-playbtn';
        playBtn.setAttribute('aria-label', 'Reproducir video');
        playBtn.innerHTML = '<svg class="playbtn-svg" viewBox="0 0 68 48" width="68" height="48"><path class="playbtn-shape" d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.13 12.21 0 24 0 24s.13 11.79 1.55 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.87 35.79 68 24 68 24s-.13-11.79-1.55-16.26z"/><path class="playbtn-triangle" d="M45 24 27 14v20z"/></svg>';
        cover.appendChild(playBtn);
        wrapper.appendChild(cover);

        // Video nativo (debajo del cover) — src diferido hasta preload zone
        var videoEl = document.createElement('video');
        videoEl.dataset.src = entry.url;
        videoEl.controls = true;
        videoEl.playsInline = true;
        videoEl.title = entry.title || 'Video subido';
        wrapper.appendChild(videoEl);

        // Guardar statusMachine para _startPreload
        card._sm = statusMachine;

        // Click en cover → reproducir
        cover.addEventListener('click', function () {
          if (cloudinaryFailed) return;
          videoEl.play().catch(function () {});
        });

        // Al reproducir: ocultar cover + pausar otros videos
        videoEl.addEventListener('play', function () {
          cover.classList.add('video-local-cover--hidden');
          YouTubeManager._pauseOthers(null, videoEl);
        });
      } else {
        // YouTube: miniatura precargada + YT.Player debajo
        var thumb = document.createElement('img');
        thumb.className = 'video-thumb';
        thumb.src = 'https://i.ytimg.com/vi/' + entry.id + '/hqdefault.jpg';
        thumb.alt = 'Miniatura';
        thumb.setAttribute('loading', 'lazy');
        thumb.setAttribute('fetchpriority', 'high');
        wrapper.appendChild(thumb);

        // Target para YT.Player — la API crea el iframe internamente
        var playerId = 'ytp-' + entry.id + '-' + (++YouTubeManager._playerIdCounter);
        var playerTarget = document.createElement('div');
        playerTarget.id = playerId;
        playerTarget.className = 'video-player-target';
        wrapper.appendChild(playerTarget);

        // NOTA: ya no creamos un overlay custom de play. El player de YouTube
        // maneja su propia UI (botón de play, controles, etc.). La miniatura
        // local cubre el iframe hasta que el video está listo (estado CUED),
        // momento en el que se revela la interfaz nativa de YT.

        // Overlay de retry
        var retryOverlay = document.createElement('div');
        retryOverlay.className = 'video-retry';
        retryOverlay.innerHTML = '<span class="video-retry-msg">No se pudo cargar</span><button class="btn video-retry-btn">↻ Reintentar</button>';
        wrapper.appendChild(retryOverlay);

        var fallback = document.createElement('a');
        fallback.className = 'video-fallback';
        fallback.href = 'https://www.youtube.com/watch?v=' + entry.id;
        fallback.target = '_blank';
        fallback.rel = 'noopener';
        fallback.textContent = 'Ver en YouTube';
        fallback.style.display = 'none';
        wrapper.appendChild(fallback);

        var embedLoaded = false;
        var retryTimers = [];

        function clearRetryTimers() {
          retryTimers.forEach(function (t) { clearTimeout(t); });
          retryTimers = [];
        }

        function onReady() {
          embedLoaded = true;
          clearRetryTimers();
          retryOverlay.style.display = 'none';
          fallback.style.display = 'none';
          card.dataset.ytReady = '1';
          statusMachine.setState('ready');
          // Fallback: el estado CUED no siempre dispara en la YT IFrame API
          // (a veces salta de UNSTARTED directo a BUFFERING/PLAYING). Después
          // de 800ms (tiempo suficiente para que el iframe renderice su poster
          // image y botón de play de YT) quitamos el thumb de forma segura.
          setTimeout(function () {
            thumb.style.opacity = '0';
          }, 800);
        }

        function onStateChange(event) {
          if (event.data === YT.PlayerState.PLAYING) {
            YouTubeManager._pauseOthers(entry.id);
            // Video reproduciendo → pausar los demás
          } else if (event.data === YT.PlayerState.CUED) {
            // Si CUED dispara (no siempre lo hace), esperamos 300ms para que
            // el iframe termine de renderizar su UI antes de quitar el thumb.
            // Si no dispara, el fallback de 800ms en onReady se encarga.
            setTimeout(function () {
              thumb.style.opacity = '0';
            }, 300);
          }
        }

        function onError() {
          showFailed();
        }

        function showFailed() {
          if (embedLoaded) return;
          // Si _cancelPreload marcó la card antes de que el error llegue,
          // no mostrar "Error de carga" en una card que ya no está en
          // precarga. _startPreload limpiará el flag al re-entrar.
          if (card._ytCancelled) return;
          retryOverlay.style.display = 'flex';
          fallback.style.display = 'flex';
          statusMachine.setState('error');
        }

        function reloadVideo() {
          card.dataset.ytReady = '';
          retryOverlay.style.display = 'none';
          fallback.style.display = 'none';
          thumb.style.opacity = '1';
          embedLoaded = false;
          // Status: error → loading (rápido)
          statusMachine.setState('loading', true);
          var player = YouTubeManager._players[entry.id];
          if (player && player.loadVideoById) {
            player.loadVideoById(entry.id);
          } else if (YouTubeManager._pendingHandlers.has(playerId)) {
            // Player no creado aún — forzar creación ahora
            YouTubeManager._pendingHandlers.delete(playerId);
            delete card.dataset.ytPending;
            YouTubeManager._createPlayer(entry.id, playerTarget, {
              onReady: onReady,
              onStateChange: onStateChange,
              onError: onError
            });
          } else {
            // Recrear player
            YouTubeManager._createPlayer(entry.id, playerTarget, {
              onReady: onReady,
              onStateChange: onStateChange,
              onError: onError
            });
          }
        }

        // Guardar handlers para crear el player cuando la card esté cerca del viewport
        YouTubeManager._pendingHandlers.set(playerId, {
          entryId: entry.id,
          onReady: onReady,
          onStateChange: onStateChange,
          onError: onError
        });
        card.dataset.ytPending = playerId;

        // Guardar los handlers en la card para poder reinstaurarlos
        // si _cancelPreload destroy el player (scroll >4 filas).
        card._ytHandlers = {
          onReady: onReady,
          onStateChange: onStateChange,
          onError: onError
        };
        // No crear el player ahora — se crea en setupScrollOptimizer cuando entra al viewport

        retryTimers.push(setTimeout(showFailed, 20000));

        retryOverlay.querySelector('.video-retry-btn').addEventListener('click', function () {
          clearRetryTimers();
          reloadVideo();
          retryTimers.push(setTimeout(showFailed, 20000));
        });
      }

      card.appendChild(wrapper);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-outline video-delete';
      deleteBtn.textContent = 'Eliminar';
      deleteBtn.addEventListener('click', function () {
        if (card._deleting) return; // Ya en curso: no-op
        // Delega en removeOne (YT teardown + storage + animación bifásica).
        removeOne(card, entry.id);
      });
      card.appendChild(deleteBtn);

      return card;
    },

    render: function (container) {
      if (YouTubeManager._initialRender) {
        if (console && console.warn) console.warn('[YouTubeManager] render() called more than once — skipping');
        return;
      }
      YouTubeManager._initialRender = true;
      YouTubeManager._destroyPlayers();
      YouTubeManager._pendingHandlers.clear();
      YouTubeManager._cancelledTargets = new Set();
      if (YouTubeManager._viewportObserver) YouTubeManager._viewportObserver.disconnect();
      if (YouTubeManager._preloadObserver) YouTubeManager._preloadObserver.disconnect();
      if (YouTubeManager._maintenanceObserver) YouTubeManager._maintenanceObserver.disconnect();
      YouTubeManager._viewportObserver = null;
      YouTubeManager._preloadObserver = null;
      YouTubeManager._maintenanceObserver = null;
      containerRef = container;
      var videos = YouTubeManager.getAll();
      container.innerHTML = '';

      if (YouTubeManager.isNearCapacity()) {
        var warn = document.createElement('p');
        warn.className = 'video-capacity-warn';
        warn.textContent = '⚠️ Tenés ' + YouTubeManager.getCount() + ' de ' + MAX_VIDEOS + ' videos guardados.';
        container.appendChild(warn);
      }

      if (videos.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">No hay videos aún. Agrega uno arriba.</p>';
        return;
      }

      videos.forEach(function (entry) {
        var card = YouTubeManager._buildCard(entry);
        container.appendChild(card);
      });
      YouTubeManager.setupScrollOptimizer();
    },

    renderOne: function (entry, container, opts) {
      containerRef = container;
      opts = opts || {};
      var card = YouTubeManager._buildCard(entry);

      // FLIP + 0.3s delay — solo si hay siblings, no es prefersReduced,
      // y la animación está habilitada. Si alguna falla, caemos al
      // fast-path existente (entrance inmediato).
      var canFlip = opts.animate !== false
                 && !prefersReduced
                 && container.children.length > 0;

      if (canFlip) {
        var siblings = Array.from(container.children).filter(function (c) {
          return !c.classList.contains('video-card--preparing')
              && !c.classList.contains('video-card--collapse');
        });
        // Si por alguna razón todos los hijos existentes están en estado
        // preparing/collapse (improbable en un solo insert), no FLIP.
        if (siblings.length === 0) canFlip = false;
      }

      if (!canFlip) {
        // Fast-path: comportamiento actual (preserva el contrato de opts.animate).
        if (opts.animate !== false) {
          card.classList.add('video-card--enter');
          if (opts.delay) {
            card.style.setProperty('--delay', opts.delay + 's');
          }
        }

        if (opts.prepend) {
          container.insertBefore(card, container.firstChild);
        } else {
          container.appendChild(card);
        }
      } else {
        // FASE 1: capturar posiciones pre-insert
        var firstRects = siblings.map(function (s) {
          return s.getBoundingClientRect();
        });

        // FASE 2: insertar la card con placeholder (clip-path recortado
        // al 100% desde la derecha → invisible pero ocupando 280px en el
        // flex para que los siblings se muevan). NO agregamos --enter acá:
        // la entrance la manejamos con transition manual en FASE 6 para
        // evitar conflictos entre animation-fill-mode:both, animation-delay
        // y la transition: opacity 0s del base de .video-card.
        card.classList.add('video-card--preparing');
        card.style.transition = 'none';

        if (opts.prepend) {
          container.insertBefore(card, container.firstChild);
        } else {
          container.appendChild(card);
        }

        // Forzar reflow para que la track nueva (clip-path recortado) se
        // materialice antes de medir las nuevas posiciones de los siblings.
        // eslint-disable-next-line no-unused-expressions
        card.offsetWidth;

        // FASE 3: capturar posiciones post-insert
        var lastRects = siblings.map(function (s) {
          return s.getBoundingClientRect();
        });

        // FASE 4: invertir con transform sin transition (la posición visual
        // aparente sigue siendo la original).
        siblings.forEach(function (s, i) {
          var dx = firstRects[i].left - lastRects[i].left;
          s.style.transform = 'translate(' + dx + 'px, 0)';
        });

        // FASE 5: doble rAF — primero se commitea la posición invertida,
        // luego en el segundo frame se aplica la transition y se quita el
        // transform para que el browser interpole a la posición natural.
        // 0.4s matchea la duración del collapse en delete (simetría
        // visual entre add y delete).
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            siblings.forEach(function (s) {
              s.style.transition = 'transform 0.4s var(--ease-smooth)';
              s.style.transform = '';
            });
          });
        });

        // FASE 6: a los 400ms, quitar el placeholder y disparar la
        // entrance con transition manual. Secuencia:
        //   1. Quitar --preparing (clip-path salta al base, instantáneo
        //      gracias al transition:clip-path 0s del base).
        //   2. Force reflow para que el cambio de clip-path se commitee.
        //   3. Setear transition de opacity+translate.
        //   4. Cambiar opacity:0→1 y translate:0 24px→0 0 → interpola 0.4s.
        // Transition manual en lugar de animation --enter para evitar el
        // conflicto con la transition: opacity 0s del base de .video-card.
        setTimeout(function () {
          card.classList.remove('video-card--preparing');
          // eslint-disable-next-line no-unused-expressions
          void card.offsetWidth; // commit del cambio de clip-path
          card.style.transition = 'opacity 0.4s var(--ease-smooth), translate 0.4s var(--ease-smooth)';
          card.style.opacity = '1';
          card.style.translate = '0 0';
        }, 400);

        // FASE 7: cleanup a los 800ms (0.4s move + 0.4s entrance). Safety net
        // por si transitionend no dispara (p.ej. tab en background).
        // NOTA: NO remover opacity/translate inline — el CSS base de .video-card
        // arranca en opacity:0 / translate:0 24px, y al removerlos la card
        // desaparece. Mantenemos el estado final visible inline.
        setTimeout(function () {
          siblings.forEach(function (s) {
            s.style.transition = '';
            s.style.transform = '';
          });
          card.style.removeProperty('transition');
        }, 800);
        // Marcar como animada para que el IntersectionObserver no interfiera
        // (re-agregando video-card--enter con fill-mode:both o disparando exit)
        card._animated = true;
        card._everEntered = true;
      }

      // RenderOne siempre agrega una card visible — crear player inmediatamente
      var pid = card.dataset.ytPending;
      if (pid) {
        card.removeAttribute('data-yt-pending');
        var h = YouTubeManager._pendingHandlers.get(pid);
        if (h) {
          YouTubeManager._pendingHandlers.delete(pid);
          var target = document.getElementById(pid);
          if (target) {
            YouTubeManager._createPlayer(h.entryId, target, {
              onReady: h.onReady,
              onStateChange: h.onStateChange,
              onError: h.onError
            });
          }
        }
      }

      YouTubeManager.setupScrollOptimizer();
      return card;
    },

    addCard: function (entry, container, opts) {
      containerRef = container;
      opts = opts || {};
      var card = YouTubeManager._buildCard(entry);

      // FLIP + 0.3s delay — solo si hay siblings, no es prefersReduced,
      // y la animaci\u00F3n est\u00E1 habilitada. Si alguna falla, caemos al
      // fast-path existente (entrance inmediato).
      var canFlip = opts.animate !== false
                 && !prefersReduced
                 && container.children.length > 0;

      if (canFlip) {
        var siblings = Array.from(container.children).filter(function (c) {
          return !c.classList.contains('video-card--preparing')
              && !c.classList.contains('video-card--collapse');
        });
        // Si por alguna raz\u00F3n todos los hijos existentes est\u00E1n en estado
        // preparing/collapse (improbable en un solo insert), no FLIP.
        if (siblings.length === 0) canFlip = false;
      }

      if (!canFlip) {
        // Fast-path: comportamiento actual (preserva el contrato de opts.animate).
        if (opts.animate !== false) {
          card.classList.add('video-card--enter');
          if (opts.delay) {
            card.style.setProperty('--delay', opts.delay + 's');
          }
        }

        if (opts.prepend) {
          container.insertBefore(card, container.firstChild);
        } else {
          container.appendChild(card);
        }
      } else {
        // FASE 1: capturar posiciones pre-insert
        var firstRects = siblings.map(function (s) {
          return s.getBoundingClientRect();
        });

        // FASE 2: insertar la card con placeholder
        card.classList.add('video-card--preparing');
        card.style.transition = 'none';

        if (opts.prepend) {
          container.insertBefore(card, container.firstChild);
        } else {
          container.appendChild(card);
        }

        // Forzar reflow
        // eslint-disable-next-line no-unused-expressions
        card.offsetWidth;

        // FASE 3: capturar posiciones post-insert
        var lastRects = siblings.map(function (s) {
          return s.getBoundingClientRect();
        });

        // FASE 4: invertir con transform
        siblings.forEach(function (s, i) {
          var dx = firstRects[i].left - lastRects[i].left;
          s.style.transform = 'translate(' + dx + 'px, 0)';
        });

        // FASE 5: doble rAF para commitar y animar
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            siblings.forEach(function (s) {
              s.style.transition = 'transform 0.4s var(--ease-smooth)';
              s.style.transform = '';
            });
          });
        });

        // FASE 6: a los 400ms, quitar placeholder y entrance
        setTimeout(function () {
          card.classList.remove('video-card--preparing');
          // eslint-disable-next-line no-unused-expressions
          void card.offsetWidth;
          card.style.transition = 'opacity 0.4s var(--ease-smooth), translate 0.4s var(--ease-smooth)';
          card.style.opacity = '1';
          card.style.translate = '0 0';
        }, 400);

        // FASE 7: cleanup a los 800ms
        // NOTA: NO remover opacity/translate inline — el CSS base de .video-card
        // arranca en opacity:0 / translate:0 24px, y al removerlos la card
        // desaparece. Mantenemos el estado final visible inline.
        setTimeout(function () {
          siblings.forEach(function (s) {
            s.style.transition = '';
            s.style.transform = '';
          });
          card.style.removeProperty('transition');
        }, 800);
        // Marcar como animada para que el IntersectionObserver no interfiera
        card._animated = true;
        card._everEntered = true;
      }

      // Observar la card con los 3 observers para que manejen preload,
      // entrance/exit por scroll, y cleanup. La card se agregó al DOM
      // después de setupScrollOptimizer, así que hay que observarla manualmente.
      if (YouTubeManager._viewportObserver) YouTubeManager._viewportObserver.observe(card);
      if (YouTubeManager._preloadObserver) YouTubeManager._preloadObserver.observe(card);
      if (YouTubeManager._maintenanceObserver) YouTubeManager._maintenanceObserver.observe(card);

      YouTubeManager._updateCapacityWarning(container);
      return card;
    },

    removeCard: function (videoId) {
      var container = containerRef || document.getElementById('video-list');
      if (!container) return;

      var card = container.querySelector('[data-video-id="' + videoId + '"]');
      if (!card) return;

      // Usar removeOne para la animaci\u00F3n b\u00EDf\u00E1sica (clip-path sweep + collapse)
      // removeOne internamente destruye SOLO ese player, llama remove(id)
      // y desvincula de todos los observers.
      removeOne(card, videoId);

      // Actualizar warning de capacidad despu\u00E9s de la eliminaci\u00F3n
      YouTubeManager._updateCapacityWarning(container);
    },

    _startPreload: function (card) {
      if (card._preloaded) return;

      // Si la card venía de un error previo, resetear a 'loading' para que
      // el usuario no vea "Error de carga" mientras se recarga. Si la carga
      // subsiguiente falla, onError/showFailed lo pondrá en 'error' de nuevo.
      if (card._sm) card._sm.setState('loading', true);

      // Limpiar flag de cancelación previa para que showFailed pueda
      // mostrar error si esta recarga falla.
      delete card._ytCancelled;

      // YouTube: create player from pending handler
      var pid = card.dataset.ytPending;
      if (pid) {
        card.removeAttribute('data-yt-pending');
        var h = YouTubeManager._pendingHandlers.get(pid);
        if (h) {
          YouTubeManager._pendingHandlers.delete(pid);
          var target = document.getElementById(pid);
          if (target) {
            YouTubeManager._createPlayer(h.entryId, target, {
              onReady: h.onReady,
              onStateChange: h.onStateChange,
              onError: h.onError
            });
          }
        }
      } else {
        // Cloudinary: set src, attach listeners, start 20s error timeout
        var videoEl = card.querySelector('video');
        if (videoEl && videoEl.dataset && videoEl.dataset.src) {
          var sm = card._sm;
          if (!sm) return;
          var cloudinaryReady = false;
          var cloudinaryFailed = false;
          var cloudinaryTimer = setTimeout(function () {
            if (!cloudinaryReady) {
              cloudinaryFailed = true;
              sm.setState('error');
            }
          }, 20000);

          var canplayHandler = function () {
            if (cloudinaryReady || cloudinaryFailed) return;
            cloudinaryReady = true;
            clearTimeout(cloudinaryTimer);
            sm.setState('ready');
          };

          var errorHandler = function () {
            if (cloudinaryReady) return;
            cloudinaryFailed = true;
            clearTimeout(cloudinaryTimer);
            sm.setState('error');
          };

          videoEl.addEventListener('canplay', canplayHandler);
          videoEl.addEventListener('error', errorHandler);
          card._cloudinaryTimer = cloudinaryTimer;
          card._canplayHandler = canplayHandler;
          card._errorHandler = errorHandler;

          videoEl.src = videoEl.dataset.src;
        }
      }

      card._preloaded = true;
    },

    _cancelPreload: function (card) {
      if (!card._preloaded) return;

      var entryId = card.dataset.videoId;
      var target = card.querySelector('.video-player-target');

      // YouTube: destruir player y reinstaurar pending state
      // para que _startPreload pueda recrearlo al volver.
      if (YouTubeManager._players[entryId]) {
        try { YouTubeManager._players[entryId].destroy(); } catch (_) {}
        delete YouTubeManager._players[entryId];

        // Reinstaurar data-yt-pending con handlers guardados
        if (target && card._ytHandlers) {
          card.dataset.ytPending = target.id;
          YouTubeManager._pendingHandlers.set(target.id, {
            entryId: entryId,
            onReady: card._ytHandlers.onReady,
            onStateChange: card._ytHandlers.onStateChange,
            onError: card._ytHandlers.onError
          });
        }
      } else if (target) {
        // El player NO se creó aún (YT API no cargó, init() está encolado
        // en _ytPendingPlayers). Marcamos el target como cancelado para que
        // el init() pendiente no lo cree cuando la API esté lista.
        YouTubeManager._cancelledTargets = YouTubeManager._cancelledTargets || new Set();
        YouTubeManager._cancelledTargets.add(target.id);
      }

      // Flag para que callbacks asíncronos tardíos (showFailed, retryTimers)
      // no modifiquen el estado de una card que ya no está en precarga.
      card._ytCancelled = true;

      // Cloudinary: stop loading, remove listeners, clear timeout
      var videoEl = card.querySelector('video');
      if (videoEl && videoEl.dataset && videoEl.dataset.src) {
        if (card._canplayHandler) {
          videoEl.removeEventListener('canplay', card._canplayHandler);
        }
        if (card._errorHandler) {
          videoEl.removeEventListener('error', card._errorHandler);
        }
        videoEl.removeAttribute('src');
      }
      if (card._cloudinaryTimer) {
        clearTimeout(card._cloudinaryTimer);
      }
      delete card._cloudinaryTimer;
      delete card._canplayHandler;
      delete card._errorHandler;

      card._preloaded = false;
    },

    setupScrollOptimizer: function () {
      // Desconectar observers anteriores
      if (YouTubeManager._viewportObserver) YouTubeManager._viewportObserver.disconnect();
      if (YouTubeManager._preloadObserver) YouTubeManager._preloadObserver.disconnect();
      if (YouTubeManager._maintenanceObserver) YouTubeManager._maintenanceObserver.disconnect();

      var scrollContainer = document.querySelector('.panel-content');
      if (!scrollContainer) return;

      var ROW_PX = 300; // alto aprox de cada fila de cards (card + gap)

      // ====================================================================
      // OBSERVER 1: VIEWPORT (0px margin, threshold [0, 0.5])
      // Detecta entrada/salida del viewport real con umbral de 50%.
      // Solo maneja animaciones --enter / --exit.
      // ====================================================================
      YouTubeManager._viewportObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var card = entry.target;
          if (card._deleting) return;

          if (entry.intersectionRatio >= 0.5) {
            // === ≥50% VISIBLE — ENTRANCE / RE-ENTRY ===
            card.classList.remove('video-card--exit');

            if (!card._animated) {
              var idx = Array.from(card.parentNode.children).indexOf(card);
              card._animated = true;
              card.style.setProperty('--delay', Math.min(idx, 10) * 0.06 + 's');
              card.classList.add('video-card--enter');
            }
            card._everEntered = true;

            // Re-trigger status text al re-entrar
            if (card._triggerStatus) {
              setTimeout((function (crd) {
                return function () { crd._triggerStatus(); };
              })(card), 400);
            }
          } else if (card._everEntered) {
            // === <50% VISIBLE — EXIT (solo si estuvo visible antes) ===
            card._everEntered = false;
            card._animated = false;
            card.classList.add('video-card--exit');

            // Restaurar thumb si el player no está listo
            if (!card.dataset.ytReady) {
              var thumb = card.querySelector('.video-thumb');
              if (thumb) thumb.style.opacity = '1';
            }
          }
        });
      }, {
        root: scrollContainer,
        threshold: [0, 0.5]
      });

      // ====================================================================
      // OBSERVER 2: PRELOAD (600px / ~2 filas de margen)
      // Cuando una card entra a esta zona, se empieza a cargar (player YT,
      // src de Cloudinary) si no estaba cargada ya.
      // ====================================================================
      YouTubeManager._preloadObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var card = entry.target;
          if (card._deleting) return;

          if (entry.isIntersecting && !card._preloaded) {
            YouTubeManager._startPreload(card);
          }
        });
      }, {
        root: scrollContainer,
        rootMargin: ROW_PX * 2 + 'px 0px ' + ROW_PX * 2 + 'px 0px',
        threshold: [0]
      });

      // ====================================================================
      // OBSERVER 3: MAINTENANCE (1200px / ~4 filas de margen)
      // Cuando una card SALE de esta zona (>4 filas de distancia), se
      // descarga para liberar memoria. Entre 2 y 4 filas la card se
      // mantiene cargada pero sin animación.
      // ====================================================================
      YouTubeManager._maintenanceObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var card = entry.target;
          if (card._deleting) return;

          if (!entry.isIntersecting && card._preloaded) {
            // Salió de la zona de 4 filas → descargar
            YouTubeManager._cancelPreload(card);
          }
        });
      }, {
        root: scrollContainer,
        rootMargin: ROW_PX * 4 + 'px 0px ' + ROW_PX * 4 + 'px 0px',
        threshold: [0]
      });

      // Observar todas las cards existentes
      document.querySelectorAll('#video-list .video-card').forEach(function (card) {
        YouTubeManager._viewportObserver.observe(card);
        YouTubeManager._preloadObserver.observe(card);
        YouTubeManager._maintenanceObserver.observe(card);
      });
    },

    // Pausar todos los videos (YT.Player + Cloudinary)
    pauseAll: function () {
      Object.keys(YouTubeManager._players).forEach(function (id) {
        var p = YouTubeManager._players[id];
        if (p && p.pauseVideo) {
          try { p.pauseVideo(); } catch (_) {}
        }
      });
      document.querySelectorAll('#video-list .video-card video').forEach(function (v) {
        try { v.pause(); } catch (_) {}
      });
    },

    animateEntries: function () {
      var cards = document.querySelectorAll('#video-list .video-card');
      if (cards.length === 0) return;

      // Reconnect observers: fueron desconectados en PanelController.open
      // para evitar que dispararan durante la ventana de animación.
      YouTubeManager.setupScrollOptimizer();

      // Solo animar las cards que están en el viewport o hasta 200px abajo.
      // El resto las maneja el viewport observer al scrollear.
      var scrollContainer = document.querySelector('.panel-content');
      var containerRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;

      var visibleIdx = 0;
      cards.forEach(function (card) {
        var cardRect = card.getBoundingClientRect();
        var isNearViewport = !containerRect ||
          cardRect.top < containerRect.bottom + 200;

        if (isNearViewport) {
          card.style.setProperty('--delay', Math.min(visibleIdx, 10) * 0.06 + 's');
          card._animated = true;
          card._everEntered = true;
          card.classList.add('video-card--enter');
          visibleIdx++;
        }
      });

      // Trigger status text solo para cards animadas
      cards.forEach(function (card) {
        if (card._animated && card._triggerStatus) {
          setTimeout((function (crd) {
            return function () { crd._triggerStatus(); };
          })(card), 600);
        }
      });
    }
  };
  var containerRef = null;

  // ======================================================================
  // removeOne — eliminación per-card con salida animada en dos fases
  // (visual + colapso de slot). Reemplaza al YouTubeManager.render() que
  // reconstruía todos los iframes. Patrón basado en comentario-item
  // (líneas 1297-1360) adaptado a flex-wrap.
  // ======================================================================
  function removeOne(card, id) {
    if (card._deleting) return;     // Idempotencia: doble click, eventos en cola
    card._deleting = true;

    // Destruir player primero si existe (sin esto, un iframe congelado
    // queda visible mientras la card se contrae).
    var p = YouTubeManager._players[id];
    if (p) { try { p.destroy(); } catch (_) {} delete YouTubeManager._players[id]; }
    YouTubeManager.remove(id);

    // Detach de todos los observers: ninguno debe re-clasificar la card
    // mientras se elimina.
    [YouTubeManager._viewportObserver, YouTubeManager._preloadObserver, YouTubeManager._maintenanceObserver].forEach(function (obs) {
      if (obs && typeof obs.unobserve === 'function') {
        obs.unobserve(card);
      }
    });

    // Si el usuario pidió menos movimiento, saltamos ambas fases y
    // removemos al toque.
    if (prefersReduced) {
      if (card.parentNode) card.parentNode.removeChild(card);
      updateVideoAggregateUI();
      return;
    }

    // FASE 1: visual — R→L clip-path sweep (transition, no keyframe, no translate).
    // Reemplaza al .video-card--exit + @keyframes video-hide del cambio anterior.
    // Mismo patrón que .comentario-item.eliminando (líneas 1004-1009).
    //
    // Pre-condición: la card puede tener .video-card--enter (animation
    // con fill-mode:both que mantiene opacity:1) y/o .video-card--exit
    // (animation keyframe video-hide). Ambos GANAN en el cascade a la
    // transition de --sweep-out, así que hay que limpiarlos y forzar un
    // reflow + opacity:1 explícito antes de aplicar el sweep. Sin esto
    // el sweep no se ve (la card simplemente desaparece al colapsar).
    card.classList.remove('video-card--enter', 'video-card--exit');
    card.style.opacity = '1';
    // eslint-disable-next-line no-unused-expressions
    void card.offsetWidth; // force reflow

    card.classList.add('video-card--sweep-out');

    var phase1Done = false;
    function onSweepEnd(e) {
      if (e.propertyName !== 'clip-path') return;   // ignora transitionend de opacity
      card.removeEventListener('transitionend', onSweepEnd);
      phase1Done = true;
      // Espera 0.2s antes del collapse: deja que la vista "registre" que
      // la card se fue antes de que los siblings empiecen a cerrarse.
      // Sin esta pausa, sweep y collapse se sienten como un solo evento.
      setTimeout(colapsarYEliminar, 200);
    }
    card.addEventListener('transitionend', onSweepEnd);

    // Fallback: si transitionend no dispara (p.ej. tab en background)
    // 600ms cubre los 0.4s de la transición + 0.2s de espera con slack.
    setTimeout(function () {
      if (!phase1Done) colapsarYEliminar();
    }, 600);

    function colapsarYEliminar() {
      if (card._collapsed) return;            // Timer + transitionend llegaron juntos
      card._collapsed = true;

      // FASE 2: layout — .video-card--collapse lleva flex-basis etc. a 0
      card.classList.add('video-card--collapse');

      function onCollapseEnd(e) {
        if (e.propertyName !== 'flex-basis') return;  // ignora los otros 3 props
        card.removeEventListener('transitionend', onCollapseEnd);
        if (card.parentNode) card.parentNode.removeChild(card);
        updateVideoAggregateUI();
      }
      card.addEventListener('transitionend', onCollapseEnd);

      // Fallback: si transitionend no dispara, removemos igual.
      setTimeout(function () {
        if (card.parentNode) card.parentNode.removeChild(card);
        updateVideoAggregateUI();
      }, 300);
    }
  }

  // ======================================================================
  // updateVideoAggregateUI — refresca el contador y el empty-state que
  // antes se actualizaban implícitamente vía YouTubeManager.render().
  // Idempotente: seguro llamarlo dos veces.
  // ======================================================================
  function updateVideoAggregateUI() {
    var listContainer = document.getElementById('video-list') || containerRef;
    if (!listContainer) return;
    var count = YouTubeManager.getCount();
    // Aviso de capacidad — delegado a _updateCapacityWarning
    YouTubeManager._updateCapacityWarning(listContainer);

    // Empty state
    var existingEmpty = listContainer.querySelector('.video-empty');
    if (count === 0 && !existingEmpty) {
      var empty = document.createElement('p');
      empty.className = 'video-empty';
      empty.style.cssText = 'text-align:center;color:var(--text-secondary);padding:20px;';
      empty.textContent = 'No hay videos aún. Agrega uno arriba.';
      listContainer.appendChild(empty);
    } else if (count > 0 && existingEmpty && existingEmpty.parentNode) {
      existingEmpty.parentNode.removeChild(existingEmpty);
    }
  }

  // ======================================================================
  // Particle System with spatial grid optimization + pause/resume
  // ======================================================================

  function buildSpatialGrid(pts, cellSize) {
    var grid = {};
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var cx = Math.floor(p.x / cellSize);
      var cy = Math.floor(p.y / cellSize);
      var key = cx + ',' + cy;
      if (!grid[key]) grid[key] = [];
      grid[key].push(i);
    }
    return grid;
  }

  var ParticleSystem = {
    running: false,
    paused: false,
    rafId: null,
    _qualityLevel: 2,    // 2=full, 1=reduced, 0=hidden
    _fpsSamples: [],
    _lastFpsTime: 0,
    _canvas: null,

    init: function () {
      if (prefersReduced) return;

      var canvas = document.getElementById('particles');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');

      // Inicializar monitoreo de FPS dinámico
      ParticleSystem._lastFpsTime = performance.now();
      ParticleSystem._fpsSamples = [];
      ParticleSystem._canvas = canvas;

      var W, H;
      function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
      }
      resize();

      var resizeTimer;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
      }, { passive: true });

      var mouse = { x: W / 2, y: H / 2 };
      var mouseMoving = false;
      var mouseStopTimer = null;
      var clicking = false;

      window.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouseMoving = true;
        clearTimeout(mouseStopTimer);
        mouseStopTimer = setTimeout(function () { mouseMoving = false; }, 150);
      }, { passive: true });

      window.addEventListener('mousedown', function () { clicking = true; });
      window.addEventListener('mouseup', function () {
        clicking = false;
        for (var i = 0; i < ParticleSystem.particles.length; i++) {
          var p = ParticleSystem.particles[i];
          var angle = (i / ParticleSystem.particles.length) * Math.PI * 2 + (Math.random() - 0.5) * 1.5;
          var force = Math.random() * 16 + 10;
          p.vx = Math.cos(angle) * force;
          p.vy = Math.sin(angle) * force;
        }
      });

      function offscreenPos() {
        var side = Math.floor(Math.random() * 4);
        if (side === 0) return { x: Math.random() * W, y: -30 };
        if (side === 1) return { x: W + 30, y: Math.random() * H };
        if (side === 2) return { x: Math.random() * W, y: H + 30 };
        return { x: -30, y: Math.random() * H };
      }

      // Cantidad dinámica según calidad, se reajusta en _adjustQuality
      var PARTICLE_COUNT = 45;
      var CONNECT_DIST = 100;
      var COLORS = [{ h: 25 }, { h: 280 }, { h: 190 }];

      ParticleSystem.particles = Array.from({ length: PARTICLE_COUNT }, function (_, i) {
        var isOff = i < PARTICLE_COUNT * 0.25;
        var pos = isOff ? offscreenPos() : { x: Math.random() * W, y: Math.random() * H };
        return {
          x: pos.x, y: pos.y,
          driftX: (Math.random() - 0.5) * 0.35,
          driftY: (Math.random() - 0.5) * 0.35,
          vx: 0, vy: 0,
          size: Math.random() * 2.5 + 0.8,
          alpha: Math.random() * 0.35 + 0.15,
          hue: COLORS[i % COLORS.length].h
        };
      });

      var pageVisible = true;

      document.addEventListener('visibilitychange', function () {
        pageVisible = !document.hidden;
        if (pageVisible && !ParticleSystem.paused) {
          ParticleSystem._startLoop();
        } else if (!pageVisible) {
          ParticleSystem._stopLoop();
        }
      });

      ParticleSystem._adjustQuality = function (fps) {
        var q = ParticleSystem._qualityLevel;
        if (q === 2 && fps < 45) {
          ParticleSystem._qualityLevel = 1; // Bajar a reducido
        } else if (q === 1 && fps < 45) {
          ParticleSystem._qualityLevel = 0; // Ocultar — muy lento
          var cvs = ParticleSystem._canvas;
          if (cvs) cvs.style.display = 'none';
          ParticleSystem._stopLoop();
          return;
        } else if (q === 1 && fps >= 55) {
          ParticleSystem._qualityLevel = 2; // Subir a full
        }
      };

      ParticleSystem._draw = function () {
        if (!pageVisible) return;
        if (ParticleSystem.paused) return;

        // === FPS measurement ===
        var now = performance.now();
        var delta = now - ParticleSystem._lastFpsTime;
        ParticleSystem._lastFpsTime = now;
        if (delta > 0) {
          ParticleSystem._fpsSamples.push(1000 / delta);
          if (ParticleSystem._fpsSamples.length >= 30) {
            var sum = 0;
            for (var si = 0; si < ParticleSystem._fpsSamples.length; si++) {
              sum += ParticleSystem._fpsSamples[si];
            }
            var avgFps = sum / ParticleSystem._fpsSamples.length;
            ParticleSystem._fpsSamples = [];
            ParticleSystem._adjustQuality(avgFps);
            // Si _adjustQuality ocultó, salir
            if (ParticleSystem._qualityLevel === 0) {
              ParticleSystem.rafId = requestAnimationFrame(ParticleSystem._draw);
              return;
            }
          }
        }

        ctx.clearRect(0, 0, W, H);
        var CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
        var pts = ParticleSystem.particles;
        var n = pts.length;

        // En calidad reducida, solo procesar las primeras 20 partículas
        var limit = ParticleSystem._qualityLevel === 1 ? Math.min(20, n) : n;

        // === UPDATE ===
        for (var i = 0; i < limit; i++) {
          var p = pts[i];
          var dx = mouse.x - p.x;
          var dy = mouse.y - p.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (clicking) {
            var force = Math.min(2.5, 15 / (dist * 0.04 + 1));
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
            p.vx *= 0.87;
            p.vy *= 0.87;
          } else if (mouseMoving && dist < 180) {
            p.vx += (dx / dist) * 0.06;
            p.vy += (dy / dist) * 0.06;
            p.vx *= 0.91;
            p.vy *= 0.91;
          } else {
            p.vx *= 0.95;
            p.vy *= 0.95;
          }

          p.x += p.driftX + p.vx;
          p.y += p.driftY + p.vy;

          if (p.x < -40) p.x = W + 40;
          if (p.x > W + 40) p.x = -40;
          if (p.y < -40) p.y = H + 40;
          if (p.y > H + 40) p.y = -40;
        }

        // === DRAW ===
        for (var i2 = 0; i2 < limit; i2++) {
          var p2 = pts[i2];
          ctx.beginPath();
          ctx.arc(p2.x, p2.y, p2.size, 0, Math.PI * 2);
          ctx.fillStyle = 'oklch(' + (p2.alpha * 100) + '% 0.22 ' + p2.hue + ')';
          ctx.fill();
        }

        // === CONNECTIONS: solo en calidad full ===
        if (ParticleSystem._qualityLevel === 2) {
          // Build spatial hash grid: cellKey → [indices]
          var grid = {};
          for (var gi = 0; gi < limit; gi++) {
            var gp = pts[gi];
            var gcx = Math.floor(gp.x / CONNECT_DIST);
            var gcy = Math.floor(gp.y / CONNECT_DIST);
            var gk = gcx + ',' + gcy;
            if (!grid[gk]) grid[gk] = [];
            grid[gk].push(gi);
          }
          // 3×3 cell neighborhood replaces O(n²) all-pairs
          for (var i3 = 0; i3 < limit; i3++) {
            var a = pts[i3];
            var cellX = Math.floor(a.x / CONNECT_DIST);
            var cellY = Math.floor(a.y / CONNECT_DIST);
            for (var dx = -1; dx <= 1; dx++) {
              for (var dy = -1; dy <= 1; dy++) {
                var nk = (cellX + dx) + ',' + (cellY + dy);
                var neighbors = grid[nk];
                if (!neighbors) continue;
                for (var ni = 0; ni < neighbors.length; ni++) {
                  var j = neighbors[ni];
                  if (j <= i3) continue;
                  var b = pts[j];
                  var d2 = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
                  if (d2 < CONNECT_DIST_SQ) {
                    var alpha = 0.15 * (1 - Math.sqrt(d2) / CONNECT_DIST);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = 'oklch(55% 0.25 25 / ' + alpha + ')';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                  }
                }
              }
            }
          }
        }

        ParticleSystem.rafId = requestAnimationFrame(ParticleSystem._draw);
      };

      ParticleSystem._startLoop = function () {
        if (ParticleSystem.rafId) return;
        if (ParticleSystem._qualityLevel === 0) return; // No iniciar si oculto
        ParticleSystem.paused = false;
        ParticleSystem.rafId = requestAnimationFrame(ParticleSystem._draw);
      };

      ParticleSystem._stopLoop = function () {
        if (ParticleSystem.rafId) {
          cancelAnimationFrame(ParticleSystem.rafId);
          ParticleSystem.rafId = null;
        }
      };

      ParticleSystem._showCanvas = function () {
        var cvs = ParticleSystem._canvas;
        if (cvs) {
          cvs.style.display = '';
          // Recalcular partículas en calidad completa para reintentar
          ParticleSystem._qualityLevel = 2;
          ParticleSystem._lastFpsTime = performance.now();
          ParticleSystem._fpsSamples = [];
        }
      };

      ParticleSystem.pause = function () {
        ParticleSystem.paused = true;
        ParticleSystem._stopLoop();
      };

      ParticleSystem.resume = function () {
        if (!pageVisible) return;
        ParticleSystem.paused = false;
        // Si estaba oculto por rendimiento, mostrar canvas y reintentar
        if (ParticleSystem._qualityLevel === 0) {
          ParticleSystem._showCanvas();
        }
        ParticleSystem._startLoop();
      };

      ParticleSystem.running = true;
      ParticleSystem._startLoop();
    }
  };

  // ======================================================================
  // CommentSync — shared comment storage via Supabase REST API
  // ======================================================================

  var CommentSync = {
    _enabled: false,
    _baseUrl: '',
    _headers: {},

    init: function () {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
      this._enabled = true;
      this._baseUrl = SUPABASE_URL + '/rest/v1/comentarios';
      this._headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      };
    },

    fetchAll: function () {
      if (!this._enabled) return Promise.reject('CommentSync not configured');
      return fetch(this._baseUrl + '?select=*&order=created_at.asc', {
        headers: this._headers
      }).then(function (res) {
        if (!res.ok) throw new Error('Comment fetch error: ' + res.status);
        return res.json();
      }).then(function (rows) {
        return rows.map(function (r) {
          return { id: r.id, nombre: r.nombre, texto: r.texto, fecha: r.fecha };
        });
      });
    },

    add: function (comment) {
      if (!this._enabled) return Promise.reject();
      return fetch(this._baseUrl, {
        method: 'POST',
        headers: this._headers,
        body: JSON.stringify({
          id: comment.id,
          nombre: comment.nombre,
          texto: comment.texto,
          fecha: comment.fecha
        })
      }).then(function (res) {
        if (!res.ok && res.status !== 409) throw new Error('Comment insert error: ' + res.status);
      });
    },

    remove: function (id) {
      if (!this._enabled) return Promise.reject();
      return fetch(this._baseUrl + '?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: this._headers
      }).then(function (res) {
        if (!res.ok) throw new Error('Comment delete error: ' + res.status);
      });
    },

    get enabled() { return this._enabled; }
  };

  // ======================================================================
  // Comments system
  // ======================================================================
  var formComentario = document.getElementById('form-comentario');
  var listaComentarios = document.getElementById('lista-comentarios');

  function generarIdUnico() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function diffComments(remoteComments, currentIds) {
    // Returns { toAdd: [...comments], toRemove: [...ids] }
    // Pure function — no side effects, easy to test.
    var remoteIds = {};
    remoteComments.forEach(function (c) { remoteIds[c.id] = true; });

    var currentIdMap = {};
    currentIds.forEach(function (id) { currentIdMap[id] = true; });

    var toAdd = remoteComments.filter(function (c) { return !currentIdMap[c.id]; });
    var toRemove = currentIds.filter(function (id) { return !remoteIds[id]; });

    return { toAdd: toAdd, toRemove: toRemove };
  }

  function cargarComentarios() {
    if (!listaComentarios) return;
    var comentarios = JSON.parse(localStorage.getItem('comentarios') || '[]');
    // Migrar comentarios viejos que no tengan id
    var migro = false;
    comentarios.forEach(function (c) {
      if (!c.id) {
        c.id = generarIdUnico();
        migro = true;
      }
    });
    if (migro) localStorage.setItem('comentarios', JSON.stringify(comentarios));
    listaComentarios.innerHTML = '';
    comentarios.forEach(function (c) { renderComentario(c); });

    // Load from Supabase in background and merge (remote is source of truth)
    // Uses incremental DOM diff instead of full innerHTML rebuild.
    // Falls back to full rebuild on any error (try/catch guard).
    if (CommentSync.enabled) {
      CommentSync.fetchAll().then(function (remoteComments) {
        localStorage.setItem('comentarios', JSON.stringify(remoteComments));

        try {
          // Incremental merge: diff remote vs current DOM, patch only what changed
          var currentItems = listaComentarios.querySelectorAll('.comentario-item');
          var currentIds = [];
          var currentMap = {};
          currentItems.forEach(function (item) {
            var id = item.getAttribute('data-id');
            if (id != null) {
              currentIds.push(id);
              currentMap[id] = item;
            }
          });

          var diff = diffComments(remoteComments, currentIds);

          // Remove deleted: animate .eliminando → .colapsando → removeChild
          diff.toRemove.forEach(function (id) {
            var item = currentMap[id];
            if (!item) return;
            item.classList.add('eliminando');
            setTimeout(function () {
              item.classList.add('colapsando');
              setTimeout(function () {
                if (item.parentNode) item.parentNode.removeChild(item);
              }, 600);
            }, 500);
          });

          // Add new: prepend via renderComentario
          diff.toAdd.forEach(function (c) {
            renderComentario(c);
          });
        } catch (_) {
          // Fallback: full rebuild on any error in incremental merge
          listaComentarios.innerHTML = '';
          remoteComments.forEach(function (c) { renderComentario(c); });
        }
      }).catch(function () {
        // Supabase unavailable, keep localStorage version
      });
    }
  }

  function renderComentario(c) {
    if (!listaComentarios) return;
    var div = document.createElement('div');
    div.className = 'comentario-item';
    div.setAttribute('data-id', c.id);
    div.innerHTML =
      '<div class="comentario-header">' +
        '<span class="comentario-nombre">' + escapeHtml(c.nombre) + '</span>' +
        '<button class="comentario-eliminar" data-id="' + c.id + '" aria-label="Eliminar comentario">&times;</button>' +
      '</div>' +
      '<div class="comentario-texto">' + escapeHtml(c.texto) + '</div>' +
      '<div class="comentario-fecha">' + c.fecha + '</div>';
    var eliminando = false;
    var eraseOk = false;
    div.querySelector('.comentario-eliminar').addEventListener('click', function () {
      if (eliminando) return; // Evitar doble click
      eliminando = true;

      // Fase 1: borrar de derecha a izquierda + difuminar
      div.classList.add('eliminando');

      function onEraseEnd(e) {
        if (e.propertyName !== 'clip-path' && e.propertyName !== 'opacity') return;
        div.removeEventListener('transitionend', onEraseEnd);
        eraseOk = true;

        // Esperar 0.5s antes de reacomodar
        setTimeout(function () {
          colapsarYEliminar();
        }, 500);
      }
      div.addEventListener('transitionend', onEraseEnd);

      function colapsarYEliminar() {
        // Fase 2: colapsar altura para reacomodar comentarios suavemente
        div.classList.add('colapsando');

        function onCollapseEnd(e2) {
          if (e2.propertyName !== 'max-height') return;
          div.removeEventListener('transitionend', onCollapseEnd);
          eliminarComentario(c.id);
          if (div.parentNode) div.parentNode.removeChild(div);
        }
        div.addEventListener('transitionend', onCollapseEnd);

        // Fallback: si transitionend del colapso no se dispara
        setTimeout(function () {
          eliminarComentario(c.id);
          if (div.parentNode) div.parentNode.removeChild(div);
        }, 600);
      }

      // Fallback: si transitionend del borrado no se dispara
      setTimeout(function () {
        if (eraseOk) return; // Ya se completó fase 1, no hacer nada
        colapsarYEliminar();
      }, 1200);
    });
    listaComentarios.prepend(div);

    // Staggered entrance for new comment
    var totalItems = listaComentarios.querySelectorAll('.comentario-item').length;
    div.style.setProperty('--i', 0);
    div.classList.add('slide-in-up');
  }

  function eliminarComentario(id) {
    CommentSync.remove(id).catch(function () {});
    var comentarios = JSON.parse(localStorage.getItem('comentarios') || '[]');
    comentarios = comentarios.filter(function (c) { return c.id !== id; });
    localStorage.setItem('comentarios', JSON.stringify(comentarios));
    // No recargar todo — el caller se encarga de remover el elemento del DOM
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (formComentario) {
    formComentario.addEventListener('submit', function (e) {
      e.preventDefault();
      var nombre = document.getElementById('nombre-input').value.trim();
      var texto = document.getElementById('comentario-input').value.trim();
      if (!nombre || !texto) return;

      var comentarios = JSON.parse(localStorage.getItem('comentarios') || '[]');
      var nuevo = { id: generarIdUnico(), nombre: nombre, texto: texto, fecha: new Date().toLocaleString('es') };
      CommentSync.add(nuevo).catch(function () {});
      comentarios.push(nuevo);
      localStorage.setItem('comentarios', JSON.stringify(comentarios));
      renderComentario(nuevo);
      formComentario.reset();
    });
  }

  // ======================================================================
  // Initialization
  // ======================================================================
  function init() {
    // Cargar YouTube IFrame API (necesaria para YT.Player)
    if (!document.getElementById('youtube-iframe-api')) {
      var ytScript = document.createElement('script');
      ytScript.id = 'youtube-iframe-api';
      ytScript.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(ytScript);
    }
    window.onYouTubeIframeAPIReady = function () {
      window._ytApiReady = true;
      if (window._ytPollTimer) {
        clearInterval(window._ytPollTimer);
        window._ytPollTimer = null;
      }
      if (window._ytPendingPlayers) {
        var pending = window._ytPendingPlayers.slice();
        window._ytPendingPlayers = [];
        pending.forEach(function (fn) { fn(); });
      }
    };

    // Init Supabase sync
    SupabaseSync.init();
    CommentSync.init();

    // YouTube: migrate existing videos on first load
    YouTubeManager.migrateExisting();

    // Render video list (from localStorage — instant)
    var videoList = document.getElementById('video-list');
    if (videoList) {
      YouTubeManager.render(videoList);
    }

    // Load from Supabase in background and merge (cross-device sync)
    if (SupabaseSync.enabled && videoList) {
      SupabaseSync.fetchAll().then(function (remoteVideos) {
        var localVideos = YouTubeManager.getAll();
        var merged = mergeVideoLists(remoteVideos, localVideos);

        // Push local-only videos to Supabase so all users see the same content
        var remoteIds = {};
        remoteVideos.forEach(function (v) { remoteIds[v.id] = true; });
        localVideos.forEach(function (v) {
          if (!remoteIds[v.id]) SupabaseSync.add(v).catch(function () {});
        });

        // Persist merged result and re-render
        localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(merged));
        YouTubeManager._initialRender = false;
        YouTubeManager.render(videoList);
      }).catch(function () {
        // Supabase unavailable — display stays as-is from localStorage
      });
    }

    // YouTube add button
    var addBtn = document.getElementById('video-add-btn');
    var urlInput = document.getElementById('video-url-input');
    var errorEl = document.getElementById('video-error');

    if (addBtn && urlInput) {
      function handleAdd() {
        var url = urlInput.value.trim();
        if (!url) return;

        var result = YouTubeManager.add(url);
        if (result === 'added') {
          urlInput.value = '';
          if (errorEl) errorEl.hidden = true;
          if (videoList) {
            var entries = YouTubeManager.getAll();
            YouTubeManager.addCard(entries[0], videoList, {
              animate: true,
              delay: 0.5,
              prepend: true
            });
          }
        } else {
          if (errorEl) {
            errorEl.hidden = false;
            if (result === 'invalid') {
              errorEl.textContent = 'URL inválida — asegurate de que sea un link de YouTube correcto.';
            } else if (result === 'duplicate') {
              errorEl.textContent = 'Ese video ya está en tu lista.';
            } else if (result === 'full') {
              errorEl.textContent = 'Límite alcanzado: no podés tener más de ' + MAX_VIDEOS + ' videos.';
            }
          }
        }
      }

      addBtn.addEventListener('click', handleAdd);
      urlInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') handleAdd();
      });
    }

    // ===== Cloudinary file upload (requiere upload preset unsigned) =====
    var fileInput = document.getElementById('video-file-input');
    var uploadBtn = document.getElementById('video-upload-btn');
    var uploadStatus = document.getElementById('video-upload-status');

    function subirACloudinary(file) {
      if (!CLOUDINARY_UPLOAD_PRESET) {
        if (uploadStatus) {
          uploadStatus.textContent = '⚠️ Configurá un upload preset en Cloudinary primero.';
        }
        return;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        if (uploadStatus) {
          uploadStatus.textContent = '❌ El archivo supera los ' + MAX_FILE_SIZE_MB + 'MB.';
        }
        return;
      }

      if (uploadStatus) uploadStatus.textContent = 'Subiendo...';

      var formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/auto/upload', {
        method: 'POST',
        body: formData
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.secure_url) {
          var result = YouTubeManager.addCloudinary(data.secure_url, data.public_id, file.name);
          if (result === 'added') {
            if (uploadStatus) uploadStatus.textContent = '✅ Video subido correctamente.';
            if (videoList) {
              var entries = YouTubeManager.getAll();
              YouTubeManager.addCard(entries[0], videoList, {
                animate: true,
                delay: 0.5,
                prepend: true
              });
            }
          } else if (result === 'duplicate') {
            if (uploadStatus) uploadStatus.textContent = '⚠️ Ese video ya está en tu lista.';
          } else if (result === 'full') {
            if (uploadStatus) uploadStatus.textContent = '❌ Límite de ' + MAX_VIDEOS + ' videos alcanzado.';
          }
        } else {
          if (uploadStatus) uploadStatus.textContent = '❌ Error al subir: ' + (data.error && data.error.message ? data.error.message : 'desconocido');
        }
      })
      .catch(function () {
        if (uploadStatus) uploadStatus.textContent = '❌ Error de conexión al subir el video.';
      });
    }

    if (fileInput && uploadBtn) {
      // Habilitar botón si Cloudinary está configurado
      if (CLOUDINARY_UPLOAD_PRESET) {
        uploadBtn.disabled = false;
        uploadBtn.title = 'Subir video a Cloudinary';
      }

      uploadBtn.addEventListener('click', function () {
        // Si no está configurado, mostrar mensaje de ayuda
        if (!CLOUDINARY_UPLOAD_PRESET) {
          if (uploadStatus) {
            uploadStatus.textContent = '⚠️ Creá un upload preset unsigned en cloudinary.com/settings/upload y poné el nombre en CLOUDINARY_UPLOAD_PRESET.';
          }
          return;
        }
        fileInput.click();
      });

      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
          subirACloudinary(fileInput.files[0]);
          fileInput.value = ''; // Reset para poder subir el mismo archivo de nuevo
        }
      });
    }

    // Init particle system BEFORE panel controller
    // (prevents race where PanelController tries to pause particles before they exist)
    ParticleSystem.init();

    // Init panel controller
    PanelController.init();

    // Load comments
    cargarComentarios();

    // Start polling for cross-device sync (checks every 15s for new/removed videos)
    initSupabasePoll();
  }

  // ======================================================================
  // Cross-device polling — checks Supabase every 15s for new/removed videos
  // ======================================================================

  function initSupabasePoll() {
    if (!SupabaseSync.enabled) return;

    setInterval(function () {
      SupabaseSync.fetchAll().then(function (remoteVideos) {
        var container = document.getElementById('video-list');
        if (!container) return;

        var localVideos = YouTubeManager.getAll();

        // Build lookup maps for O(1) comparison
        var localIds = {};
        localVideos.forEach(function (v) { localIds[v.id] = true; });

        var remoteMap = {};
        remoteVideos.forEach(function (v) { remoteMap[v.id] = true; });

        // Add new videos from remote with slide-in animation
        remoteVideos.forEach(function (v) {
          if (!localIds[v.id]) {
            var result = YouTubeManager._addEntry(v);
            if (result === 'added') {
              YouTubeManager.addCard(v, container, { animate: true, delay: 0.3, prepend: true });
            }
          }
        });

        // Remove videos that were deleted on another device
        localVideos.forEach(function (v) {
          if (!remoteMap[v.id]) {
            YouTubeManager.removeCard(v.id);
          }
        });

        // Push local-only videos to Supabase (catches any edge cases)
        localVideos.forEach(function (v) {
          if (!remoteMap[v.id]) {
            SupabaseSync.add(v).catch(function () {});
          }
        });
      }).catch(function () {
        // Supabase unavailable — skip this poll cycle
      });
    }, 15000);
  }

  // ======================================================================
  // Test hooks — exposed for vitest + jsdom unit tests
  // ======================================================================
  if (typeof window !== 'undefined') {
    window.__test__ = {
      StatusMachine: StatusMachine,
      mergeVideoLists: mergeVideoLists,
      removeOne: removeOne,
      buildCard: function (entry) {
        return YouTubeManager._buildCard(entry);
      },
      pauseAllPlayersIncluding: function (activeId) {
        YouTubeManager._pauseOthers(activeId);
      },
      resetPlayers: function () {
        YouTubeManager._players = {};
      },
      addPlayer: function (id, mockPlayer) {
        YouTubeManager._players[id] = mockPlayer;
      },
      // Render-optimized helpers
      YouTubeManager: YouTubeManager,
      addCard: function (entry, container, opts) {
        return YouTubeManager.addCard(entry, container, opts);
      },
      removeCard: function (videoId) {
        return YouTubeManager.removeCard(videoId);
      },
      render: function (container) {
        return YouTubeManager.render(container);
      },
      updateCapacityWarning: function (container) {
        return YouTubeManager._updateCapacityWarning(container);
      },
      resetInitialRender: function () {
        YouTubeManager._initialRender = false;
      }
    };
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
