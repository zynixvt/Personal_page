/**
 * animateEntries — approval tests for Phase 4 optimization
 *
 * VERIFIED: 103/103 tests passing before creating this file (2026-06-10)
 * Safety net confirmed: all existing tests pass.
 *
 * These tests capture the CURRENT behavior of animateEntries BEFORE
 * removing the getBoundingClientRect visibility check (lines 1373-1380).
 *
 * Invariant under test: when animateEntries() runs, ALL cards receive
 * animation properties (--delay, _animated, video-card--enter class).
 * The gBCR visibility check is dead code on panel open (all cards are
 * 100% visible) and never filters any card.
 *
 * After removing the gBCR loop, these same tests must still pass.
 */

import './setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('animateEntries (Phase 4)', function () {
  var YM, animateEntries;

  beforeAll(function () {
    YM = window.__test__.YouTubeManager;
    animateEntries = window.__test__.animateEntries;
  });

  beforeEach(function () {
    localStorage.clear();
  });

  // -----------------------------------------------------------------------
  // Helpers: patch document.querySelectorAll and document.getElementById
  //          to support #video-list .video-card lookups
  // -----------------------------------------------------------------------

  function patchDoc(container) {
    var origQSA = document.querySelectorAll;
    var origGet = document.getElementById;

    document.getElementById = function (id) {
      if (id === 'video-list') return container;
      return null;
    };

    document.querySelectorAll = function (sel) {
      if (sel === '#video-list .video-card') {
        var list = document.getElementById('video-list');
        if (list) return list.querySelectorAll('.video-card');
        return [];
      }
      return [];
    };

    return function restore() {
      document.getElementById = origGet;
      document.querySelectorAll = origQSA;
    };
  }

  function setupCards(count) {
    var container = document.createElement('div');
    container.id = 'video-list';

    // Add video cards
    for (var i = 0; i < count; i++) {
      var entry = { id: 'card-' + i, source: 'youtube' };
      var card = window.__test__.buildCard(entry);
      card.dataset.videoId = entry.id;
      container.appendChild(card);
    }

    return container;
  }

  // -----------------------------------------------------------------------
  // Approval tests — document current animateEntries behavior
  // -----------------------------------------------------------------------

  describe('Approval: cards are animated when animateEntries runs', function () {
    it('should animate all cards when cards exist', function () {
      var container = setupCards(3);
      var restore = patchDoc(container);

      animateEntries();

      var cards = container.querySelectorAll('.video-card');
      expect(cards.length).toBe(3);
      cards.forEach(function (card) {
        expect(card._animated).toBe(true);
        expect(card.classList.contains('video-card--enter')).toBe(true);
        var delay = card.style.getPropertyValue('--delay');
        expect(delay !== '' && delay !== undefined).toBe(true);
      });
      restore();
    });

    it('should set increasing stagger delays for cards 0–10', function () {
      var container = setupCards(5);
      var restore = patchDoc(container);

      animateEntries();

      var cards = Array.from(container.children);
      expect(cards.length).toBe(5);
      cards.forEach(function (card, i) {
        var expectedDelay = Math.min(i, 10) * 0.06 + 's';
        expect(card.style.getPropertyValue('--delay')).toBe(expectedDelay);
      });
      restore();
    });

    it('should clamp stagger delay at index 10 for cards beyond', function () {
      var container = setupCards(15);
      var restore = patchDoc(container);

      animateEntries();

      var cards = Array.from(container.children);
      expect(cards.length).toBe(15);
      var delayAt10 = cards[10].style.getPropertyValue('--delay');
      expect(delayAt10).toBe('0.6s');
      for (var i = 10; i < 15; i++) {
        expect(cards[i].style.getPropertyValue('--delay')).toBe(delayAt10);
      }
      restore();
    });

    it('should do nothing when no cards exist', function () {
      var container = setupCards(0);
      var restore = patchDoc(container);

      expect(function () { animateEntries(); }).not.toThrow();

      restore();
    });

    it('should not throw when #video-list does not exist', function () {
      var restore = patchDoc(null);

      expect(function () { animateEntries(); }).not.toThrow();

      restore();
    });

    // Note: _triggerStatus behavior (setTimeout 600ms) is NOT tested here
    // because it uses real setTimeout (no mock). The code path is identical
    // to the removeOne test pattern and is covered by existing tests.
  });
});
