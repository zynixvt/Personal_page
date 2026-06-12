/**
 * StatusMachine — unit tests
 *
 * StatusMachine is extracted from _buildCard and handles
 * loading → ready → error → hide transitions with CSS class
 * mapping, slide animations, color preservation on hide,
 * and auto-hide after 2s in "ready" state.
 */

import './setup.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('StatusMachine', () => {
  var machine, statusEl, statusDot, statusText;

  beforeEach(function () {
    // Create the DOM structure that _buildCard normally creates
    statusDot = document.createElement('span');
    statusDot.className = 'video-status-dot';

    statusText = document.createElement('span');
    statusText.className = 'video-status-text';
    statusText.textContent = 'Cargando...';

    statusEl = document.createElement('span');
    statusEl.className = 'video-status';
    statusEl.appendChild(statusDot);
    statusEl.appendChild(statusText);

    machine = window.__test__.StatusMachine(statusEl);
  });

  it('should have the correct element reference', function () {
    expect(machine.el).toBe(statusEl);
  });

  it('should start in loading state with correct classes', function () {
    // Initial state set by constructor
    expect(statusDot.classList.contains('status-loading')).toBe(true);
    expect(statusText.classList.contains('status-loading')).toBe(true);
    expect(statusText.textContent).toBe('Cargando...');
  });

  it('should transition loading → ready with correct classes and text', function () {
    vi.useFakeTimers();
    machine.setState('ready');

    // Immediately: slide-out with loading color preserved
    expect(statusText.classList.contains('status-slide-out')).toBe(true);

    // Advance past the 400ms slide-out delay
    vi.advanceTimersByTime(400);

    // After delay: ready classes and text
    expect(statusDot.classList.contains('status-ready')).toBe(true);
    expect(statusText.classList.contains('status-ready')).toBe(true);
    expect(statusText.classList.contains('status-slide-in')).toBe(true);
    expect(statusText.textContent).toBe('Listo');
  });

  it('should transition loading → error with correct classes and text', function () {
    vi.useFakeTimers();
    machine.setState('error');

    // Advance past the 400ms slide-out delay
    vi.advanceTimersByTime(400);

    expect(statusDot.classList.contains('status-error')).toBe(true);
    expect(statusText.classList.contains('status-error')).toBe(true);
    expect(statusText.textContent).toBe('Error de carga');
  });

  it('should auto-hide "ready" text after 2000ms but preserve color', function () {
    vi.useFakeTimers();
    machine.setState('ready');

    // Advance past the 400ms slide-out delay + 2000ms auto-hide delay
    vi.advanceTimersByTime(400); // slide-out completes
    vi.advanceTimersByTime(2000); // auto-hide timeout fires

    // After auto-hide: slides out but preserves green color
    expect(statusText.classList.contains('status-slide-out')).toBe(true);
    expect(statusText.classList.contains('status-ready')).toBe(true);
  });

  it('should hide with previous color preserved', function () {
    vi.useFakeTimers();
    machine.setState('ready');
    vi.advanceTimersByTime(400);

    // Now hide
    machine.setState('hide');

    // Should go directly to slide-out with color preserved (no delay)
    expect(statusText.classList.contains('status-slide-out')).toBe(true);
    expect(statusText.classList.contains('status-ready')).toBe(true);
  });

  it('should preserve error color on hide', function () {
    vi.useFakeTimers();
    machine.setState('error');
    vi.advanceTimersByTime(400);

    machine.setState('hide');

    expect(statusText.classList.contains('status-slide-out')).toBe(true);
    expect(statusText.classList.contains('status-error')).toBe(true);
  });

  it('should handle fast transitions (150ms delay)', function () {
    vi.useFakeTimers();
    machine.setState('error', true); // fast = true

    // Should use 150ms delay instead of 400ms
    vi.advanceTimersByTime(150);

    expect(statusDot.classList.contains('status-error')).toBe(true);
    expect(statusText.classList.contains('status-error')).toBe(true);
  });

  it('should re-trigger status via _triggerStatus', function () {
    vi.useFakeTimers();
    machine.setState('ready');
    vi.advanceTimersByTime(400);

    // Simulate scroll re-entry: call _triggerStatus
    machine._triggerStatus();

    // Should re-apply the current state with fast transition
    vi.advanceTimersByTime(150); // fast delay

    expect(statusDot.classList.contains('status-ready')).toBe(true);
    expect(statusText.classList.contains('status-ready')).toBe(true);
    expect(statusText.textContent).toBe('Listo');
  });

  it('should handle setState returning undefined (no return value needed)', function () {
    var result = machine.setState('ready');
    expect(result).toBeUndefined();
  });

  it('should transition error → loading → ready (reset on scroll re-entry)', function () {
    vi.useFakeTimers();
    // Simular card que falló al cargar
    machine.setState('error');
    vi.advanceTimersByTime(400);
    expect(statusDot.classList.contains('status-error')).toBe(true);
    expect(statusText.textContent).toBe('Error de carga');

    // _startPreload resetea a loading al re-entrar en zona de precarga
    machine.setState('loading', true);
    vi.advanceTimersByTime(150); // fast delay
    expect(statusDot.classList.contains('status-loading')).toBe(true);
    expect(statusText.classList.contains('status-loading')).toBe(true);
    expect(statusText.textContent).toBe('Cargando...');

    // La recarga subsiguiente funciona
    machine.setState('ready');
    vi.advanceTimersByTime(400);
    expect(statusDot.classList.contains('status-ready')).toBe(true);
    expect(statusText.textContent).toBe('Listo');
  });

  it('should transition error → loading → error (error persists after retry)', function () {
    vi.useFakeTimers();
    // Primer error
    machine.setState('error');
    vi.advanceTimersByTime(400);

    // Reset a loading (como hace _startPreload)
    machine.setState('loading', true);
    vi.advanceTimersByTime(150);
    expect(statusText.textContent).toBe('Cargando...');

    // Vuelve a fallar
    machine.setState('error');
    vi.advanceTimersByTime(400);
    expect(statusDot.classList.contains('status-error')).toBe(true);
    expect(statusText.textContent).toBe('Error de carga');
  });
});
