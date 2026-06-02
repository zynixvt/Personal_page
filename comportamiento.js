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
        // Small delay for transition to start
        requestAnimationFrame(function () {
          backBtn.focus();
        });
      }
    },

    close: function () {
      if (!PanelController.activePanel) return;

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

    render: function (container) {
      var videos = YouTubeManager.getAll();
      container.innerHTML = '';

      // Capacity warning
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
        var card = document.createElement('div');
        card.className = 'card video-card';

        // Badge de origen
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
        card.appendChild(badge);

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
        } else {
          // YouTube: render como <iframe>
          var iframe = document.createElement('iframe');
          iframe.src = 'https://www.youtube.com/embed/' + entry.id;
          iframe.title = 'YouTube video';
          iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
          iframe.setAttribute('allowfullscreen', '');
          iframe.setAttribute('loading', 'lazy');
          wrapper.appendChild(iframe);

          // Overlay de retry (se muestra si no carga después del timeout)
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

          function onLoad() {
            embedLoaded = true;
            clearRetryTimers();
            retryOverlay.style.display = 'none';
            fallback.style.display = 'none';
            iframe.style.opacity = '1';
          }

          function showFailed() {
            if (embedLoaded) return;
            retryOverlay.style.display = 'flex';
            fallback.style.display = 'flex';
            iframe.style.opacity = '0.3';
          }

          function reloadVideo() {
            retryOverlay.style.display = 'none';
            fallback.style.display = 'none';
            iframe.style.opacity = '1';
            // Cache-busting para forzar recarga desde cero
            iframe.src = 'https://www.youtube.com/embed/' + entry.id + '?_=' + Date.now();
          }

          iframe.addEventListener('load', onLoad);

          // Check único: si no cargó después de 20s, mostrar fallback + overlay
          retryTimers.push(setTimeout(showFailed, 20000));

          // Botón manual de retry — sin auto-retry que interrumpa
          retryOverlay.querySelector('.video-retry-btn').addEventListener('click', function () {
            clearRetryTimers();
            reloadVideo();
            // Reprogramar un solo timeout
            retryTimers.push(setTimeout(showFailed, 20000));
          });
        }

        card.appendChild(wrapper);

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-outline video-delete';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.addEventListener('click', function () {
          YouTubeManager.remove(entry.id);
          YouTubeManager.render(container);
        });
        card.appendChild(deleteBtn);

        container.appendChild(card);
      });
    }
  };

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
      var CELL_SIZE = CONNECT_DIST;
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

        // Frame budget: si el dispositivo es lento, saltear frames pares
        if (ParticleSystem._slowDevice) {
          ParticleSystem._frameSkip++;
          if (ParticleSystem._frameSkip % 2 === 0) {
            ParticleSystem.rafId = requestAnimationFrame(ParticleSystem._draw);
            return;
          }
        }

        ctx.clearRect(0, 0, W, H);

        // Update particles
        for (var i = 0; i < ParticleSystem.particles.length; i++) {
          var p = ParticleSystem.particles[i];
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

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = 'oklch(' + (p.alpha * 100) + '% 0.22 ' + p.hue + ')';
          ctx.fill();
        }

        // Spatial grid for connection optimization
        var grid = new Map();

        for (var i2 = 0; i2 < ParticleSystem.particles.length; i2++) {
          var p2 = ParticleSystem.particles[i2];
          var col = Math.floor(p2.x / CELL_SIZE);
          var row = Math.floor(p2.y / CELL_SIZE);
          var key = col + ',' + row;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(i2);
        }

        // Only connect particles in same or adjacent cells
        for (var i3 = 0; i3 < ParticleSystem.particles.length; i3++) {
          var p3 = ParticleSystem.particles[i3];
          var colC = Math.floor(p3.x / CELL_SIZE);
          var rowC = Math.floor(p3.y / CELL_SIZE);

          for (var dc = -1; dc <= 1; dc++) {
            for (var dr = -1; dr <= 1; dr++) {
              var nk = (colC + dc) + ',' + (rowC + dr);
              var cell = grid.get(nk);
              if (!cell) continue;

              for (var ci = 0; ci < cell.length; ci++) {
                var j = cell[ci];
                if (j <= i3) continue;

                var dx2 = p3.x - ParticleSystem.particles[j].x;
                var dy2 = p3.y - ParticleSystem.particles[j].y;
                var dist2 = dx2 * dx2 + dy2 * dy2;

                if (dist2 < CONNECT_DIST * CONNECT_DIST) {
                  var alpha = 0.15 * (1 - Math.sqrt(dist2) / CONNECT_DIST);
                  ctx.beginPath();
                  ctx.moveTo(p3.x, p3.y);
                  ctx.lineTo(ParticleSystem.particles[j].x, ParticleSystem.particles[j].y);
                  ctx.strokeStyle = 'oklch(55% 0.25 25 / ' + alpha + ')';
                  ctx.lineWidth = 0.5;
                  ctx.stroke();
                }
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
          if (videoList) YouTubeManager.render(videoList);
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
            if (videoList) YouTubeManager.render(videoList);
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
