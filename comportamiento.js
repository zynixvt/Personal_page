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

        // Desconectar observer: si quedara activo, dispararía al abrir el panel
        // y agregaría la clase de animación antes de tiempo. Se reconecta
        // en animateEntries al final de la ventana de animación.
        if (YouTubeManager._observer) {
          YouTubeManager._observer.disconnect();
        }

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
        }, 650);

        // 2) Videos animation: T=1350ms (form done + 0.3s)
        //    animateEntries internamente filtra por ≥50% de visibilidad
        setTimeout(function () {
          YouTubeManager.animateEntries();
        }, 1350);
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

      // Disconnect observer when closing videos panel (reconnected on next open)
      if (PanelController.activePanel === 'videos') {
        if (YouTubeManager._observer) {
          YouTubeManager._observer.disconnect();
          YouTubeManager._observer = null;
        }
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
  var CLOUDINARY_CLOUD_NAME = 'ddxn2k6nt';
  var CLOUDINARY_UPLOAD_PRESET = 'VID_DataBase';
  var MAX_FILE_SIZE_MB = 50;

  // Supabase
  var SUPABASE_URL = 'https://pcnyekkuhovfycfxjfpx.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_brqVUs-64msjtqctFX02kQ_iU_OQdbt';

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

    // Colección de players YT.Player (entry.id → YT.Player)
    _players: {},
    _playerIdCounter: 0,
    _pendingHandlers: new Map(),

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
      card._state = 'loading';

      var statusEl = document.createElement('span');
      statusEl.className = 'video-status';
      statusEl.appendChild(statusDot);
      statusEl.appendChild(statusText);
      // El texto se desliza al animar la card (no acá)

      // Helper para cambiar estado del status con slide-out → slide-in
      var _statusTimeoutId;
      function setStatus(state, fast) {
        clearTimeout(_statusTimeoutId);
        // Save previous state for slide-out color preservation
        var prevState = card._state || 'loading';
        card._state = state;
        var delay = fast ? 150 : 400;

        if (state === 'hide') {
          statusText.className = 'video-status-text status-slide-out';
          // Preserve color while sliding out
          if (prevState === 'ready') statusText.classList.add('status-ready');
          else if (prevState === 'error') statusText.classList.add('status-error');
          return;
        }

        // Slide out current text WITH its color preserved
        statusText.className = 'video-status-text status-slide-out';
        if (prevState === 'ready') statusText.classList.add('status-ready');
        else if (prevState === 'error') statusText.classList.add('status-error');

        _statusTimeoutId = setTimeout(function () {
          // Resetear clases y poner nuevo estado
          statusDot.className = 'video-status-dot';
          statusText.className = 'video-status-text';
          if (state === 'ready') {
            statusDot.classList.add('status-ready');
            statusText.classList.add('status-ready');
            statusText.textContent = 'Listo';
            statusText.classList.add('status-slide-in');

            // Auto-hide "Listo" after 2s — KEEP green while sliding out
            _statusTimeoutId = setTimeout(function () {
              statusText.className = 'video-status-text status-slide-out';
              statusText.classList.add('status-ready');
            }, 2000);
          } else if (state === 'error') {
            statusDot.classList.add('status-error');
            statusText.classList.add('status-error');
            statusText.textContent = 'Error de carga';
            statusText.classList.add('status-slide-in');
            // Stays visible until retry
          } else {
            // loading
            statusDot.classList.add('status-loading');
            statusText.classList.add('status-loading');
            statusText.textContent = 'Cargando...';
            statusText.classList.add('status-slide-in');
          }
        }, delay);
      }

      // Re-trigger status animation based on current state (for scroll re-entry)
      card._triggerStatus = function () {
        setStatus(card._state || 'loading', true);
      };

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
        // Cloudinary: render como <video>
        var videoEl = document.createElement('video');
        videoEl.src = entry.url;
        videoEl.controls = true;
        videoEl.playsInline = true;
        videoEl.preload = 'metadata';
        videoEl.title = entry.title || 'Video subido';
        wrapper.appendChild(videoEl);

        // Al reproducir un video subido, pausar los YT players y otros Cloudinary
        videoEl.addEventListener('play', function () {
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
          setStatus('ready');
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
          retryOverlay.style.display = 'flex';
          fallback.style.display = 'flex';
          setStatus('error');
        }

        function reloadVideo() {
          card.dataset.ytReady = '';
          retryOverlay.style.display = 'none';
          fallback.style.display = 'none';
          thumb.style.opacity = '1';
          embedLoaded = false;
          // Status: error → loading (rápido)
          setStatus('loading', true);
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
        removeOne(card, entry.id, YouTubeManager._observer);
      });
      card.appendChild(deleteBtn);

      return card;
    },

    render: function (container) {
      YouTubeManager._destroyPlayers();
      YouTubeManager._pendingHandlers.clear();
      if (YouTubeManager._observer) {
        YouTubeManager._observer.disconnect();
        YouTubeManager._observer = null;
      }
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

    setupScrollOptimizer: function () {
      if (YouTubeManager._observer) {
        YouTubeManager._observer.disconnect();
      }

      var scrollContainer = document.querySelector('.panel-content');
      if (!scrollContainer) return;

      // Single IntersectionObserver: handles YT player creation, entrance AND exit.
      // threshold [0.5] dispara al cruzar 50% en cualquier dirección:
      //   isIntersecting=true  → card entró (o re-entró) al viewport
      //   isIntersecting=false → card salió del viewport (debajo del 50%)
      // El gate `card._animated` previene que cards no-visibles en panel open
      // inicial disparen exit al setup (porque aún no fueron animadas).
      YouTubeManager._observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var card = entry.target;
          if (card._deleting) return; // No re-clasificar una card en eliminación
          // Índice de la card en la lista → se usa para stagger tanto en
          // entrance como en exit (mismo delay = simetría visual)
          var allCards = document.querySelectorAll('#video-list .video-card');
          var idx = Array.prototype.indexOf.call(allCards, card);

          if (entry.isIntersecting) {
            // === ENTRANCE / RE-ENTRY ===

            // Si la card estaba saliendo, cancelar el exit y re-disparar entrance.
            // El force reflow garantiza que el browser registre la remoción de exit
            // antes de re-agregar enter → animación arranca desde el estado final
            // del exit (opacity:0, translate:0 24px) que coincide con el from del
            // entrance → sin flash.
            if (card.classList.contains('video-card--exit')) {
              card.classList.remove('video-card--exit');
              void card.offsetWidth; // force reflow
            }

            // Create YT player if pending (always, not gated by _animated)
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

            // Entrance animation (primera vez o re-entry) con stagger por índice
            if (!card._animated) {
              card._animated = true;
              card.style.setProperty('--delay', Math.min(idx, 10) * 0.08 + 's');
              card.classList.add('video-card--enter');
            }

            // Status text re-animation for scroll re-entry (state-aware)
            if (card._triggerStatus) {
              setTimeout(function (crd) {
                return function () {
                  crd._triggerStatus();
                };
              }(card), 600);
            }
          } else {
            // === EXIT ===

            // Solo aplicar exit si la card ya fue animada antes. Esto previene
            // que cards que aún no entraron (panel open inicial, observer setup)
            // disparen exit al ser evaluadas con isIntersecting=false.
            if (!card.classList.contains('video-card--exit') && card._animated) {
              card._animated = false;
              // Stagger por índice: cards de arriba (índice bajo) salen primero
              // al hacer scroll up, y arrancan su animación antes → salida
              // secuencial de arriba hacia abajo.
              card.style.setProperty('--delay', Math.min(idx, 10) * 0.08 + 's');
              card.classList.add('video-card--exit');
            }

            // Restore thumb si la card no está lista (el player de YT no cargó aún)
            if (!card.dataset.ytReady) {
              var thumb = card.querySelector('.video-thumb');
              if (thumb) thumb.style.opacity = '1';
            }
          }
        });
      }, {
        root: scrollContainer,
        rootMargin: '0px 0px -50px 0px',
        threshold: [0.5]
      });

      document.querySelectorAll('#video-list .video-card').forEach(function (card) {
        YouTubeManager._observer.observe(card);
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

      // Reconnect observer: fue desconectado en PanelController.open para
      // evitar que disparara durante la ventana de animación. setupScrollOptimizer
      // desconecta el existente y crea uno fresh.
      YouTubeManager.setupScrollOptimizer();

      // Visibility check: solo animar cards con ≥50% de visibilidad en el scroll
      // container. Las que no pasen este umbral las maneja el IntersectionObserver
      // cuando entren al viewport (esa animación se afina en el fix de scroll).
      var scrollContainer = document.querySelector('.panel-content');
      var containerRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;

      // Animar cards visibles con stagger de 80ms
      cards.forEach(function (card, i) {
        if (containerRect) {
          var cardRect = card.getBoundingClientRect();
          var visibleTop = Math.max(cardRect.top, containerRect.top);
          var visibleBottom = Math.min(cardRect.bottom, containerRect.bottom);
          var visibleHeight = Math.max(0, visibleBottom - visibleTop);
          // Skip cards con menos del 50% visible
          if (visibleHeight < cardRect.height * 0.5) return;
        }

        // Stagger 80ms por card → se sienten "una por una" sin ser lento
        card.style.setProperty('--delay', Math.min(i, 10) * 0.08 + 's');
        card._animated = true;
        card.classList.add('video-card--enter');
      });

      // Trigger status text solo para cards animadas (las que sí se ven)
      cards.forEach(function (card) {
        if (card._animated && card._triggerStatus) {
          setTimeout(function (crd) {
            return function () { crd._triggerStatus(); };
          }(card), 600);
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
  function removeOne(card, id, observer) {
    if (card._deleting) return;     // Idempotencia: doble click, eventos en cola
    card._deleting = true;

    // Destruir player primero si existe (sin esto, un iframe congelado
    // queda visible mientras la card se contrae).
    var p = YouTubeManager._players[id];
    if (p) { try { p.destroy(); } catch (_) {} delete YouTubeManager._players[id]; }
    YouTubeManager.remove(id);

    // Detach del observer: el IntersectionObserver de setupScrollOptimizer
    // no debe re-clasificar la card mientras se elimina.
    if (observer && typeof observer.unobserve === 'function') {
      observer.unobserve(card);
    }

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
    card.classList.add('video-card--sweep-out');

    var phase1Done = false;
    function onSweepEnd(e) {
      if (e.propertyName !== 'clip-path') return;   // ignora transitionend de opacity
      card.removeEventListener('transitionend', onSweepEnd);
      phase1Done = true;
      colapsarYEliminar();
    }
    card.addEventListener('transitionend', onSweepEnd);

    // Fallback: si transitionend no dispara (p.ej. tab en background)
    // 600ms cubre los 0.5s de la transición con 100ms de slack.
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
      }, 400);
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

    // Aviso de capacidad
    var existingWarn = listContainer.querySelector('.video-capacity-warn');
    if (count >= WARN_AT_VIDEOS) {
      if (!existingWarn) {
        var warn = document.createElement('p');
        warn.className = 'video-capacity-warn';
        warn.textContent = '⚠️ Tenés ' + count + ' de ' + MAX_VIDEOS + ' videos guardados.';
        listContainer.insertBefore(warn, listContainer.firstChild);
      } else {
        existingWarn.textContent = '⚠️ Tenés ' + count + ' de ' + MAX_VIDEOS + ' videos guardados.';
      }
    } else if (existingWarn && existingWarn.parentNode) {
      existingWarn.parentNode.removeChild(existingWarn);
    }

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
  var ParticleSystem = {
    running: false,
    paused: false,
    rafId: null,
    _slowDevice: false,
    _frameSkip: 0,

    init: function () {
      if (prefersReduced) return;

      var canvas = document.getElementById('particles');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');

      // Detectar dispositivo lento (mobile, pocos cores, o batería baja)
      var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      var cores = navigator.hardwareConcurrency || 4;
      ParticleSystem._slowDevice = isMobile || cores <= 4;

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

      var PARTICLE_COUNT = ParticleSystem._slowDevice ? 20 : 45;
      var CONNECT_DIST = ParticleSystem._slowDevice ? 60 : 100;
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

      ParticleSystem._draw = function () {
        if (!pageVisible) return;
        if (ParticleSystem.paused) return;

        // Frame budget: solo en dispositivos lentos, saltear frames pares
        if (ParticleSystem._slowDevice) {
          ParticleSystem._frameSkip++;
          if (ParticleSystem._frameSkip % 2 === 0) {
            ParticleSystem.rafId = requestAnimationFrame(ParticleSystem._draw);
            return;
          }
        }

        ctx.clearRect(0, 0, W, H);
        var CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
        var pts = ParticleSystem.particles;
        var n = pts.length;

        // === UPDATE (separado del draw) ===
        for (var i = 0; i < n; i++) {
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

        // === DRAW: batch de partículas (update + draw separados) ===
        for (var i2 = 0; i2 < n; i2++) {
          var p2 = pts[i2];
          ctx.beginPath();
          ctx.arc(p2.x, p2.y, p2.size, 0, Math.PI * 2);
          ctx.fillStyle = 'oklch(' + (p2.alpha * 100) + '% 0.22 ' + p2.hue + ')';
          ctx.fill();
        }

        // === CONNECTIONS: O(n²) directo, sin spatial grid (más rápido para <50 partículas) ===
        if (!ParticleSystem._slowDevice) {
          for (var i3 = 0; i3 < n; i3++) {
            var a = pts[i3];
            for (var j = i3 + 1; j < n; j++) {
              var b = pts[j];
              var ddx = a.x - b.x;
              var ddy = a.y - b.y;
              if (ddx > CONNECT_DIST || ddx < -CONNECT_DIST) continue;
              if (ddy > CONNECT_DIST || ddy < -CONNECT_DIST) continue;
              var d2 = ddx * ddx + ddy * ddy;
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

        ParticleSystem.rafId = requestAnimationFrame(ParticleSystem._draw);
      };

      ParticleSystem._startLoop = function () {
        if (ParticleSystem.rafId) return;
        ParticleSystem.paused = false;
        ParticleSystem.rafId = requestAnimationFrame(ParticleSystem._draw);
      };

      ParticleSystem._stopLoop = function () {
        if (ParticleSystem.rafId) {
          cancelAnimationFrame(ParticleSystem.rafId);
          ParticleSystem.rafId = null;
        }
      };

      ParticleSystem.pause = function () {
        ParticleSystem.paused = true;
        ParticleSystem._stopLoop();
      };

      ParticleSystem.resume = function () {
        if (!pageVisible) return;
        ParticleSystem.paused = false;
        ParticleSystem._startLoop();
      };

      ParticleSystem.running = true;
      ParticleSystem._startLoop();
    }
  };

  // ======================================================================
  // Comments system (preserved from original)
  // ======================================================================
  var formComentario = document.getElementById('form-comentario');
  var listaComentarios = document.getElementById('lista-comentarios');

  function generarIdUnico() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
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
  }

  function renderComentario(c) {
    if (!listaComentarios) return;
    var div = document.createElement('div');
    div.className = 'comentario-item';
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

    // YouTube: migrate existing videos on first load
    YouTubeManager.migrateExisting();

    // Render video list (from localStorage — instant)
    var videoList = document.getElementById('video-list');
    if (videoList) {
      YouTubeManager.render(videoList);
    }

    // Load from Supabase in background and merge
    if (SupabaseSync.enabled && videoList) {
      SupabaseSync.fetchAll().then(function (remoteVideos) {
        var localVideos = YouTubeManager.getAll();
        if (remoteVideos.length === 0 && localVideos.length > 0) {
          // Supabase vacío, migrar videos locales a Supabase
          localVideos.forEach(function (v) {
            SupabaseSync.add(v).catch(function () {});
          });
        } else if (remoteVideos.length > 0) {
          // Mezclar: remote gana en conflictos, locales que no estén remotos se agregan
          var merged = mergeVideoLists(remoteVideos, localVideos);
          localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(merged));
          YouTubeManager.render(videoList);
        }
      }).catch(function () {
        // Supabase no disponible, todo ok con localStorage
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
            YouTubeManager.renderOne(entries[0], videoList, {
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
              YouTubeManager.renderOne(entries[0], videoList, {
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
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
