/**
 * _pauseOthers — unit tests
 *
 * Tests YouTubeManager._pauseOthers which pauses all YT.Player
 * instances except the currently active one, and also pauses
 * native <video> elements in the DOM.
 *
 * Exposed via window.__test__.pauseAllPlayersIncluding(activeId)
 * with player helpers via __test__.resetPlayers() and
 * __test__.addPlayer(id, mockPlayer).
 */

import './setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

describe('_pauseOthers', function () {
  var pauseFn, resetPlayers, addPlayer;

  beforeAll(function () {
    pauseFn = window.__test__.pauseAllPlayersIncluding;
    resetPlayers = window.__test__.resetPlayers;
    addPlayer = window.__test__.addPlayer;
  });

  beforeEach(function () {
    resetPlayers();
  });

  it('should call pauseVideo on players other than the active one', function () {
    var player1 = { pauseVideo: vi.fn(), destroy: vi.fn() };
    var player2 = { pauseVideo: vi.fn(), destroy: vi.fn() };
    var player3 = { pauseVideo: vi.fn(), destroy: vi.fn() };

    addPlayer('vid1', player1);
    addPlayer('vid2', player2);
    addPlayer('vid3', player3);

    pauseFn('vid2');

    expect(player1.pauseVideo).toHaveBeenCalledTimes(1);
    expect(player3.pauseVideo).toHaveBeenCalledTimes(1);
    expect(player2.pauseVideo).not.toHaveBeenCalled();
  });

  it('should NOT pause the current player', function () {
    var player = { pauseVideo: vi.fn(), destroy: vi.fn() };
    addPlayer('onlyOne', player);

    pauseFn('onlyOne');

    expect(player.pauseVideo).not.toHaveBeenCalled();
  });

  it('should handle empty players map gracefully', function () {
    // No players added
    expect(function () {
      pauseFn('anyId');
    }).not.toThrow();
  });

  it('should handle null/undefined player gracefully', function () {
    addPlayer('valid', { pauseVideo: vi.fn(), destroy: vi.fn() });
    addPlayer('nullPlayer', null);
    addPlayer('missingMethod', { notPause: true });

    expect(function () {
      pauseFn('valid');
    }).not.toThrow();
  });

  it('should handle a single player being paused', function () {
    var player1 = { pauseVideo: vi.fn(), destroy: vi.fn() };
    var player2 = { pauseVideo: vi.fn(), destroy: vi.fn() };

    addPlayer('a', player1);
    addPlayer('b', player2);

    pauseFn('a');

    expect(player1.pauseVideo).not.toHaveBeenCalled();
    expect(player2.pauseVideo).toHaveBeenCalledTimes(1);
  });

  it('should not throw when player objects have no pauseVideo method', function () {
    var player = { };
    addPlayer('defective', player);

    expect(function () {
      pauseFn('nonexistent');
    }).not.toThrow();
  });

  it('should handle clearing players between tests', function () {
    var player = { pauseVideo: vi.fn(), destroy: vi.fn() };
    addPlayer('temp', player);
    resetPlayers();

    expect(function () {
      pauseFn('temp');
    }).not.toThrow();
  });

  it('should call pause on every players except current when there are many', function () {
    var players = {};
    var spies = {};
    var ids = ['p1', 'p2', 'p3', 'p4', 'p5'];

    ids.forEach(function (id) {
      spies[id] = { pauseVideo: vi.fn(), destroy: vi.fn() };
      addPlayer(id, spies[id]);
    });

    pauseFn('p3');

    ids.forEach(function (id) {
      if (id === 'p3') {
        expect(spies[id].pauseVideo).not.toHaveBeenCalled();
      } else {
        expect(spies[id].pauseVideo).toHaveBeenCalledTimes(1);
      }
    });
  });
});
