/**
 * _buildCard — DOM structure tests
 *
 * Tests the DOM generation inside YouTubeManager._buildCard.
 * We create entries and verify the output card structure.
 * Exposed via window.__test__.buildCard(entry).
 */

import './setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

describe('_buildCard DOM structure', function () {
  var buildCard;

  beforeAll(function () {
    buildCard = window.__test__.buildCard;
  });

  it('should return a card element with video-card class', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    expect(card.classList.contains('video-card')).toBe(true);
    expect(card.classList.contains('card')).toBe(true);
  });

  it('should contain a thumbnail image', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var thumb = card.querySelector('.video-thumb');
    expect(thumb).not.toBeNull();
    expect(thumb.tagName).toBe('IMG');
    expect(thumb.getAttribute('src').includes('i.ytimg.com')).toBe(true);
  });

  it('should contain a status dot', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var dot = card.querySelector('.video-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.tagName).toBe('SPAN');
  });

  it('should contain a status text with initial loading message', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var text = card.querySelector('.video-status-text');
    expect(text).not.toBeNull();
    expect(text.textContent).toBe('Cargando...');
  });

  it('should contain a delete button', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var deleteBtn = card.querySelector('.video-delete');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn.tagName).toBe('BUTTON');
    expect(deleteBtn.textContent).toBe('Eliminar');
  });

  it('should contain a YouTube badge for YouTube sources', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var badge = card.querySelector('.video-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('YouTube');
    expect(badge.tagName).toBe('A');
    expect(badge.classList.contains('video-badge--link')).toBe(true);
  });

  it('should have a header row with status and badge', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var header = card.querySelector('.video-card-header');
    expect(header).not.toBeNull();
    expect(header.querySelector('.video-status')).not.toBeNull();
    expect(header.querySelector('.video-badge')).not.toBeNull();
  });

  it('should have a player target div for YouTube', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var target = card.querySelector('.video-player-target');
    expect(target).not.toBeNull();
    expect(target.id.startsWith('ytp-test123-')).toBe(true);
  });

  it('should have a retry overlay for YouTube', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var retry = card.querySelector('.video-retry');
    expect(retry).not.toBeNull();
    expect(retry.querySelector('.video-retry-btn')).not.toBeNull();
  });

  it('should have a fallback link for YouTube', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    var fallback = card.querySelector('.video-fallback');
    expect(fallback).not.toBeNull();
    expect(fallback.getAttribute('href').includes('test123')).toBe(true);
  });

  it('should create Cloudinary cards with video-local-cover', function () {
    var card = buildCard({
      id: 'cloud123',
      source: 'cloudinary',
      url: 'https://res.cloudinary.com/test/video.mp4',
      title: 'Test Video'
    });
    var cover = card.querySelector('.video-local-cover');
    expect(cover).not.toBeNull();
    var playBtn = card.querySelector('.video-local-playbtn');
    expect(playBtn).not.toBeNull();
    var thumb = card.querySelector('.video-local-thumb');
    expect(thumb).not.toBeNull();
    var video = card.querySelector('video');
    expect(video).not.toBeNull();
    expect(video.dataset.src.includes('cloudinary.com')).toBe(true);
  });

  it('should have a "Subido" badge for Cloudinary sources', function () {
    var card = buildCard({
      id: 'cloud123',
      source: 'cloudinary',
      url: 'https://res.cloudinary.com/test/video.mp4'
    });
    var badge = card.querySelector('.video-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Subido');
    expect(badge.tagName).toBe('SPAN');
  });

  it('should set data-yt-pending for YouTube cards', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    expect(card.dataset.ytPending).toBeTruthy();
  });

  it('should have _triggerStatus function on card', function () {
    var card = buildCard({ id: 'test123', source: 'youtube' });
    expect(typeof card._triggerStatus).toBe('function');
  });
});
