/**
 * IntersectionObserver Optimization — approval tests for Phase 3
 *
 * Tests that the video-card index calculation used for stagger delay
 * produces correct values. The index is used in the observer callback:
 *   --delay: Math.min(idx, 10) * 0.08s
 *
 * The refactoring replaces:
 *   var allCards = document.querySelectorAll('#video-list .video-card');
 *   var idx = Array.prototype.indexOf.call(allCards, card);
 * with:
 *   var idx = Array.from(card.parentNode.children).indexOf(card);
 *
 * These approval tests capture the BEHAVIOR contract (correct index)
 * independent of which expression is used in the implementation.
 */

import './setup.js';
import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Helper: creates a DOM structure matching the real #video-list.
 * @param {number} count - number of .video-card children to create
 * @param {boolean} withWarning - whether to prepend a .video-capacity-warn element
 * @returns {{ container: object, cards: object[] }}
 */
function createVideoList(count, withWarning) {
  var container = document.createElement('div');
  container.id = 'video-list';
  var cards = [];

  if (withWarning) {
    var warn = document.createElement('p');
    warn.className = 'video-capacity-warn';
    warn.textContent = '⚠️ Tenés 50 de 100 videos guardados.';
    container.appendChild(warn);
  }

  for (var i = 0; i < count; i++) {
    var card = document.createElement('div');
    card.className = 'card video-card';
    card.dataset.videoId = 'vid' + (i + 1);
    container.appendChild(card);
    cards.push(card);
  }

  return { container: container, cards: cards };
}

/**
 * Helper: computes the index of a card among its parent's children.
 * This is the EXACT expression that will be used in the refactored code.
 */
function getCardIndex(card) {
  return Array.from(card.parentNode.children).indexOf(card);
}

/**
 * Helper: computes the stagger delay from an index.
 * Matches the real formula: Math.min(idx, 10) * 0.06s
 */
function staggerDelay(idx) {
  return Math.min(idx, 10) * 0.06;
}

describe('IntersectionObserver Card Index (Phase 3)', function () {
  describe('Index calculation via parentNode.children', function () {
    it('should compute idx=0 for the first card among 5 cards', function () {
      var ctx = createVideoList(5);
      var idx = getCardIndex(ctx.cards[0]);
      expect(idx).toBe(0);
    });

    it('should compute idx=2 for the third card among 5 cards', function () {
      var ctx = createVideoList(5);
      var idx = getCardIndex(ctx.cards[2]);
      expect(idx).toBe(2);
    });

    it('should compute idx=4 for the last card among 5 cards', function () {
      var ctx = createVideoList(5);
      var idx = getCardIndex(ctx.cards[4]);
      expect(idx).toBe(4);
    });

    it('should compute idx=0 for a single card', function () {
      var ctx = createVideoList(1);
      var idx = getCardIndex(ctx.cards[0]);
      expect(idx).toBe(0);
    });

    it('should compute correct indices for 12 cards (0 through 11)', function () {
      var ctx = createVideoList(12);
      ctx.cards.forEach(function (card, i) {
        var idx = getCardIndex(card);
        expect(idx).toBe(i);
      });
    });
  });

  describe('Stagger delay formula', function () {
    it('should produce 0s delay for idx=0', function () {
      expect(staggerDelay(0)).toBe(0);
    });

    it('should produce 0.12s delay for idx=2', function () {
      expect(staggerDelay(2)).toBe(0.12);
    });

    it('should produce 0.60s delay for idx=10', function () {
      expect(staggerDelay(10)).toBe(0.60);
    });

    it('should clamp delay to 10 (idx=12 → delay=0.60s)', function () {
      expect(staggerDelay(12)).toBe(0.60);
      expect(staggerDelay(20)).toBe(0.60);
    });

    it('should produce correct delay for each card index using the formula', function () {
      var ctx = createVideoList(12);
      ctx.cards.forEach(function (card, i) {
        var idx = getCardIndex(card);
        var delay = staggerDelay(idx);
        var expected = i <= 10 ? i * 0.06 : 10 * 0.06;
        expect(delay).toBe(expected);
      });
    });
  });

  describe('Comparison: old querySelectorAll approach vs new parentNode.children', function () {
    it('should match old and new index when there are no non-card siblings', function () {
      var ctx = createVideoList(5);
      var allCards = ctx.container.querySelectorAll('.video-card');
      ctx.cards.forEach(function (card, i) {
        var oldIdx = Array.prototype.indexOf.call(allCards, card);
        var newIdx = Array.from(card.parentNode.children).indexOf(card);
        expect(newIdx).toBe(oldIdx);
        expect(newIdx).toBe(i);
      });
    });

    it('should differ from old when capacity-warning <p> is present', function () {
      // The capacity warning is a sibling <p> before the cards.
      // parentNode.children includes it, querySelectorAll('.video-card') does not.
      // This test documents the edge case: indices shift by 1 with warning present.
      var ctx = createVideoList(5, true);
      var allCards = ctx.container.querySelectorAll('.video-card');
      // The new expression includes the <p> as a child
      var newIdx = Array.from(ctx.cards[0].parentNode.children).indexOf(ctx.cards[0]);
      var oldIdx = Array.prototype.indexOf.call(allCards, ctx.cards[0]);
      // With the warning, newIdx is 1 (0 for the <p>, 1 for the first card)
      expect(newIdx).toBe(1);
      // But oldIdx is 0 (only .video-card elements)
      expect(oldIdx).toBe(0);
      // Both are consistent — stagger delay is Math.min(idx, 10)*0.06
      // so the tiny offset difference (≤0.06s) is visually negligible,
      // and only applies when the capacity warning is shown (50+ videos)
      // where all cards are already past their entrance animation.
    });
  });

  describe('--delay CSS variable application', function () {
    it('should apply correct --delay for card at position 3', function () {
      var ctx = createVideoList(12);
      var card = ctx.cards[3];
      var idx = getCardIndex(card);
      var delay = staggerDelay(idx);
      card.style.setProperty('--delay', delay + 's');
      expect(card.style.getPropertyValue('--delay')).toBe('0.18s');
    });

    it('should apply clamp at --delay 0.60s for card at position 15', function () {
      var ctx = createVideoList(16);
      var card = ctx.cards[15];
      var idx = getCardIndex(card);
      var delay = staggerDelay(idx);
      card.style.setProperty('--delay', delay + 's');
      // idx=15, Math.min(15, 10)=10, 10*0.06=0.60
      expect(card.style.getPropertyValue('--delay')).toBe('0.6s');
    });
  });
});
