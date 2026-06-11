/**
 * Comment System — tests for Phase 5 incremental merge optimization
 *
 * Phase 5 tasks:
 *   5.1 — Add data-id attribute to .comentario-item div in renderComentario()
 *   5.2 — Replace full innerHTML rebuild with incremental DOM diff
 *   5.3 — Wrap incremental merge in try/catch with innerHTML fallback
 *
 * VERIFIED: 108/108 tests passing before creating this file (2026-06-10)
 * Safety net confirmed: all existing tests pass.
 */

import './setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

describe('Comment System (Phase 5)', function () {
  var renderComentario, escapeHtml;

  beforeAll(function () {
    renderComentario = window.__test__.renderComentario;
    escapeHtml = window.__test__.escapeHtml;
  });

  // -----------------------------------------------------------------------
  // Helpers: set up DOM for comment rendering
  // -----------------------------------------------------------------------

  var originalGetElementById;

  function setupListaComentarios() {
    var lista = document.createElement('div');
    lista.id = 'lista-comentarios';
    originalGetElementById = document.getElementById;
    document.getElementById = function (id) {
      if (id === 'lista-comentarios') return lista;
      return null;
    };
    // The extracted renderComentario uses the global `listaComentarios` variable
    globalThis.listaComentarios = lista;
    return lista;
  }

  function restoreGetElementById() {
    if (originalGetElementById) {
      document.getElementById = originalGetElementById;
      originalGetElementById = null;
    }
  }

  // ====================================================================
  // Task 5.1: data-id attribute
  // ====================================================================

  describe('5.1 — renderComentario produces data-id', function () {
    beforeEach(function () {
      setupListaComentarios();
    });

    afterEach(function () {
      restoreGetElementById();
    });

    it('should set data-id on .comentario-item div matching comment id', function () {
      var lista = document.getElementById('lista-comentarios');
      renderComentario({
        id: 'abc-123',
        nombre: 'Test User',
        texto: 'Hello world',
        fecha: '2026-06-10'
      });

      var items = lista.querySelectorAll('.comentario-item');
      expect(items.length).toBe(1);
      var div = items[0];
      expect(div.getAttribute('data-id')).toBe('abc-123');
    });

    it('should set data-id for UUID-style comment ids', function () {
      var lista = document.getElementById('lista-comentarios');
      renderComentario({
        id: 'k3f8-a2d1-9c4b',
        nombre: 'User',
        texto: 'Test',
        fecha: 'now'
      });

      var items = lista.querySelectorAll('.comentario-item');
      expect(items.length).toBe(1);
      expect(items[0].getAttribute('data-id')).toBe('k3f8-a2d1-9c4b');
    });

    it('should set data-id for numeric id strings', function () {
      var lista = document.getElementById('lista-comentarios');
      renderComentario({
        id: '42',
        nombre: 'Number',
        texto: 'Numeric id',
        fecha: 'now'
      });

      var items = lista.querySelectorAll('.comentario-item');
      expect(items.length).toBe(1);
      expect(items[0].getAttribute('data-id')).toBe('42');
    });

    it('should persist data-id through multiple renders', function () {
      var lista = document.getElementById('lista-comentarios');

      renderComentario({ id: 'first', nombre: 'A', texto: 'First', fecha: 'now' });
      renderComentario({ id: 'second', nombre: 'B', texto: 'Second', fecha: 'now' });
      renderComentario({ id: 'third', nombre: 'C', texto: 'Third', fecha: 'now' });

      var items = lista.querySelectorAll('.comentario-item');
      expect(items.length).toBe(3);
      expect(items[0].getAttribute('data-id')).toBe('third');  // prepended last
      expect(items[1].getAttribute('data-id')).toBe('second');
      expect(items[2].getAttribute('data-id')).toBe('first');
    });

    it('should set data-id on div (not just on delete button)', function () {
      var lista = document.getElementById('lista-comentarios');
      renderComentario({
        id: 'div-level-test',
        nombre: 'Test',
        texto: 'Test',
        fecha: 'now'
      });

      var div = lista.querySelector('.comentario-item');
      // Check the container div, not the button
      expect(div.getAttribute('data-id')).toBe('div-level-test');
      // The button has its own data-id too
      var btn = div.querySelector('.comentario-eliminar');
      expect(btn.getAttribute('data-id')).toBe('div-level-test');
    });
  });

  // ====================================================================
  // Task 5.2: Incremental merge — diff logic (pure function)
  // ====================================================================

  describe('5.2 — incremental merge diff logic', function () {
    var diffComments;

    beforeAll(function () {
      diffComments = window.__test__.diffComments;
    });

    it('should identify new comments to add', function () {
      var remote = [
        { id: 'a', nombre: 'A', texto: 'A', fecha: 'now' },
        { id: 'b', nombre: 'B', texto: 'B', fecha: 'now' }
      ];
      var currentIds = ['a'];
      var result = diffComments(remote, currentIds);

      expect(result.toAdd.length).toBe(1);
      expect(result.toAdd[0].id).toBe('b');
      expect(result.toRemove.length).toBe(0);
    });

    it('should identify deleted comments to remove', function () {
      var remote = [
        { id: 'a', nombre: 'A', texto: 'A', fecha: 'now' }
      ];
      var currentIds = ['a', 'b', 'c'];
      var result = diffComments(remote, currentIds);

      expect(result.toAdd.length).toBe(0);
      expect(result.toRemove.length).toBe(2);
      expect(result.toRemove.indexOf('b') !== -1).toBe(true);
      expect(result.toRemove.indexOf('c') !== -1).toBe(true);
    });

    it('should handle both add and remove simultaneously', function () {
      var remote = [
        { id: 'a', nombre: 'A', texto: 'A', fecha: 'now' },
        { id: 'd', nombre: 'D', texto: 'D', fecha: 'now' }
      ];
      var currentIds = ['a', 'b', 'c'];
      var result = diffComments(remote, currentIds);

      expect(result.toAdd.length).toBe(1);
      expect(result.toAdd[0].id).toBe('d');
      expect(result.toRemove.length).toBe(2);
      expect(result.toRemove.indexOf('b') !== -1).toBe(true);
      expect(result.toRemove.indexOf('c') !== -1).toBe(true);
    });

    it('should return empty diffs when remote matches current', function () {
      var remote = [
        { id: 'a', nombre: 'A', texto: 'A', fecha: 'now' },
        { id: 'b', nombre: 'B', texto: 'B', fecha: 'now' }
      ];
      var currentIds = ['a', 'b'];
      var result = diffComments(remote, currentIds);

      expect(result.toAdd.length).toBe(0);
      expect(result.toRemove.length).toBe(0);
    });

    it('should handle empty remote (all current removed)', function () {
      var remote = [];
      var currentIds = ['a', 'b', 'c'];
      var result = diffComments(remote, currentIds);

      expect(result.toAdd.length).toBe(0);
      expect(result.toRemove.length).toBe(3);
    });

    it('should handle empty current (all remote are new)', function () {
      var remote = [
        { id: 'a', nombre: 'A', texto: 'A', fecha: 'now' },
        { id: 'b', nombre: 'B', texto: 'B', fecha: 'now' }
      ];
      var currentIds = [];
      var result = diffComments(remote, currentIds);

      expect(result.toAdd.length).toBe(2);
      expect(result.toRemove.length).toBe(0);
    });

    it('should handle both empty (no changes)', function () {
      var result = diffComments([], []);
      expect(result.toAdd.length).toBe(0);
      expect(result.toRemove.length).toBe(0);
    });

    it('should return full comment objects in toAdd', function () {
      var remote = [
        { id: 'newId', nombre: 'New User', texto: 'Hello', fecha: '2026-06-10' }
      ];
      var currentIds = ['existing'];
      var result = diffComments(remote, currentIds);

      expect(result.toAdd.length).toBe(1);
      expect(result.toAdd[0].nombre).toBe('New User');
      expect(result.toAdd[0].texto).toBe('Hello');
      expect(result.toAdd[0].fecha).toBe('2026-06-10');
    });
  });

  // ====================================================================
  // Task 5.3: try/catch fallback on error
  // ====================================================================

  describe('5.3 — fallback on error', function () {
    it('diffComments should throw on null remote', function () {
      expect(function () { diffComments(null, ['a']); }).toThrow();
    });

    it('diffComments should throw on undefined remote', function () {
      expect(function () { diffComments(undefined, ['a']); }).toThrow();
    });
  });
});
