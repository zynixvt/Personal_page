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
  // YouTubeManager — URL parsing, localStorage CRUD, render
  // ======================================================================
  var STORAGE_KEY = 'youtube-videos';
  var MAX_VIDEOS = 100;
  var WARN_AT_VIDEOS = 50;
  var EXISTING_IDS = ['sYuKxwo-7Sw', 'kqejYrjVuNk', 'gg2kxw2qOPs'];

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

      videos.push({
        id: id,
        title: title || '',
        addedAt: new Date().toISOString()
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    },

    getAll: function () {
      try {
        var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
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
          title: '',
          addedAt: new Date().toISOString()
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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

        var wrapper = document.createElement('div');
        wrapper.className = 'video-card-wrapper';

        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube.com/embed/' + entry.id;
        iframe.title = 'YouTube video';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('loading', 'lazy');
        wrapper.appendChild(iframe);

        var fallback = document.createElement('a');
        fallback.className = 'video-fallback';
        fallback.href = 'https://www.youtube.com/watch?v=' + entry.id;
        fallback.target = '_blank';
        fallback.rel = 'noopener';
        fallback.textContent = 'Ver en YouTube';
        // Hide fallback by default — only shown if embed fails
        fallback.style.display = 'none';
        wrapper.appendChild(fallback);

        // Reliable fallback: timeout-based, since iframe 'error' event
        // is not standardized across browsers for embed blocking.
        var embedLoaded = false;
        var FALLBACK_TIMEOUT_MS = 8000;
        iframe.addEventListener('load', function () {
          embedLoaded = true;
        });
        setTimeout(function () {
          if (!embedLoaded) {
            iframe.style.display = 'none';
            fallback.style.display = 'flex';
          }
        }, FALLBACK_TIMEOUT_MS);

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

    init: function () {
      if (prefersReduced) return;

      var canvas = document.getElementById('particles');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');

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

      var PARTICLE_COUNT = 45;
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

        // Spatial grid for connection optimization (~100px cells)
        var CELL_SIZE = 100;
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

                if (dist2 < 10000) {
                  var alpha = 0.15 * (1 - Math.sqrt(dist2) / 100);
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
    // YouTube: migrate existing videos on first load
    YouTubeManager.migrateExisting();

    // Render video list
    var videoList = document.getElementById('video-list');
    if (videoList) {
      YouTubeManager.render(videoList);
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
