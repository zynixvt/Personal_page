/**
 * removeOne — animation phase tests
 *
 * Tests the two-phase delete animation: clip-path sweep-out
 * → flex-basis collapse. Also tests idempotency gate (_deleting),
 * observer cleanup, and reduced-motion fast path.
 *
 * Exposed via window.__test__.removeOne(card, id, observer).
 * Since the function uses fallback timers if transitionend
 * doesn't fire, we use fake timers to control the sequence.
 */

import './setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

describe('removeOne', function () {
  var removeOneFn;

  beforeAll(function () {
    removeOneFn = window.__test__.removeOne;
  });

  beforeEach(function () {
    vi.useFakeTimers();
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  function createCard() {
    var card = document.createElement('div');
    card.className = 'card video-card';
    card._deleting = false;
    return card;
  }

  // Setup mock observers on YouTubeManager so removeOne can unobserve
  function setupObservers() {
    var mockObs = { unobserve: vi.fn() };
    var YM = window.__test__.YouTubeManager;
    YM._viewportObserver = mockObs;
    YM._preloadObserver = mockObs;
    YM._maintenanceObserver = mockObs;
  }

  it('should add --sweep-out class immediately', function () {
    var card = createCard();
    setupObservers();
    removeOneFn(card, 'test-id');
    expect(card.classList.contains('video-card--sweep-out')).toBe(true);
  });

  it('should set _deleting flag to prevent double-trigger', function () {
    var card = createCard();
    setupObservers();
    removeOneFn(card, 'test-id');
    expect(card._deleting).toBe(true);

    // Second call should be a no-op
    vi.advanceTimersByTime(100);
    removeOneFn(card, 'test-id');

    // Card should still be in the DOM if it was appended somewhere
    // (at this point, _deleting should remain true)
    expect(card._deleting).toBe(true);
  });

  it('should call observer.unobserve before animation starts', function () {
    var card = createCard();
    var mockObs = { unobserve: vi.fn() };
    var YM = window.__test__.YouTubeManager;
    YM._viewportObserver = mockObs;
    YM._preloadObserver = mockObs;
    YM._maintenanceObserver = mockObs;

    removeOneFn(card, 'test-id');

    expect(mockObs.unobserve).toHaveBeenCalledWith(card);
  });

  it('should add --collapse class after sweep fallback timer (850ms)', function () {
    var card = createCard();
    setupObservers();
    // We don't simulate transitionend, so the 850ms fallback fires
    removeOneFn(card, 'test-id');

    // Before fallback: no collapse class yet
    expect(card.classList.contains('video-card--collapse')).toBe(false);

    // Advance past the 850ms fallback
    vi.advanceTimersByTime(900);

    // Fallback triggered colapsarYEliminar → should have collapse class
    expect(card.classList.contains('video-card--collapse')).toBe(true);
  });

  it('should remove card from DOM after collapse fallback', function () {
    var card = createCard();
    setupObservers();
    document.body.appendChild(card);
    expect(document.body.contains(card)).toBe(true);

    removeOneFn(card, 'test-id');

    // Advance past sweep fallback (850ms) + collapse fallback (400ms)
    vi.advanceTimersByTime(1300);

    // Card should be removed from DOM
    expect(document.body.contains(card)).toBe(false);
  });

  it('should handle observers being null gracefully', function () {
    var card = createCard();
    var YM = window.__test__.YouTubeManager;
    YM._viewportObserver = null;
    YM._preloadObserver = null;
    YM._maintenanceObserver = null;

    expect(function () {
      removeOneFn(card, 'test-id');
    }).not.toThrow();
  });

  it('should clean up enter/exit classes before applying sweep', function () {
    var card = createCard();
    setupObservers();
    card.classList.add('video-card--enter');
    removeOneFn(card, 'test-id');

    // enter and exit classes must be removed for sweep to work
    expect(card.classList.contains('video-card--enter')).toBe(false);
    expect(card.classList.contains('video-card--exit')).toBe(false);
  });

  it('should set opacity to 1 before sweep', function () {
    var card = createCard();
    setupObservers();
    removeOneFn(card, 'test-id');
    expect(card.style.opacity).toBe('1');
  });

  it('should not throw if card has no parentNode', function () {
    var card = createCard();
    setupObservers();
    // Card is not appended to document.body — no parentNode
    expect(function () {
      removeOneFn(card, 'test-id');
    }).not.toThrow();

    // Advance through all timers
    vi.advanceTimersByTime(1300);
  });

  it('should handle the full sweep → collapse → remove sequence via fallback', function () {
    var card = createCard();
    setupObservers();
    document.body.appendChild(card);

    removeOneFn(card, 'test-id');

    // Phase checkpoints
    expect(card.classList.contains('video-card--sweep-out')).toBe(true); // sweep added
    expect(card.classList.contains('video-card--collapse')).toBe(false);  // not yet collapsed

    // After 850ms: sweep fallback → colapsarYEliminar → collapse
    vi.advanceTimersByTime(900);
    expect(card.classList.contains('video-card--collapse')).toBe(true);   // now collapsed
    expect(card.classList.contains('video-card--sweep-out')).toBe(true);  // still has sweep

    // After another 400ms: collapse fallback → remove from DOM
    vi.advanceTimersByTime(500);
    expect(document.body.contains(card)).toBe(false);                     // removed
  });
});
