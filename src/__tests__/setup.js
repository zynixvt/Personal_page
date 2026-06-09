/**
 * Global setup — provides browser API mocks and loads extracted functions.
 *
 * IMPORTANT: This uses manual mocks instead of jsdom because jsdom
 * causes vitest to hang on Node.js v26. The mocks are sufficient for
 * unit testing the extracted pure-logic functions.
 *
 * Order: first set up globals (document, localStorage, YT, etc.),
 * then call preload to extract and eval the testable functions.
 */

import { setupTestHooks } from './preload.js';

// ---------------------------------------------------------------------------
// Minimal Element factory
// ---------------------------------------------------------------------------
function makeEl(tag) {
  var cls = [];
  var dataset = {};
  var ch = [];
  var el = {
    tagName: (tag || 'div').toUpperCase(),
    nodeType: 1,
    get className() { return cls.join(' '); },
    set className(v) { cls = v ? String(v).trim().split(/\s+/) : []; },
    classList: {
      add: function () {
        for (var i = 0; i < arguments.length; i++) { if (!cls.includes(arguments[i])) cls.push(arguments[i]); }
        el.className = cls.join(' ');
      },
      remove: function () {
        for (var i = 0; i < arguments.length; i++) { cls = cls.filter(function (x) { return x !== arguments[i]; }); }
        el.className = cls.join(' ');
      },
      contains: function (c) { return cls.includes(c); },
      toggle: function (c, force) {
        if (force !== undefined) {
          if (force && !cls.includes(c)) { cls.push(c); }
          else if (!force) { cls = cls.filter(function (x) { return x !== c; }); }
        } else {
          if (cls.includes(c)) { cls = cls.filter(function (x) { return x !== c; }); }
          else { cls.push(c); }
        }
        el.className = cls.join(' ');
        return cls.includes(c);
      },
      get length() { return cls.length; },
      item: function (i) { return cls[i] || null; },
      toString: function () { return cls.join(' '); },
    },
    dataset: dataset,
    style: {},
    textContent: '',
    innerHTML: '',
    appendChild: function (c) { ch.push(c); c._parentEl = el; if (typeof c.parentNode === 'undefined') { Object.defineProperty(c, 'parentNode', { get: function() { return c._parentEl || null; } }); } return c; },
    removeChild: function (c) { var i = ch.indexOf(c); if (i !== -1) { ch.splice(i, 1); c._parentEl = null; } return c; },
    insertBefore: function (child, ref) { ch.push(child); child._parentEl = el; return child; },
    replaceChild: function (n, o) { var i = ch.indexOf(o); if (i !== -1) { ch[i] = n; n._parentEl = el; } return o; },
    querySelector: function (sel) {
      if (!sel) return null;
      // Support .className selectors
      if (sel[0] === '.') {
        var name = sel.slice(1);
        if (el.classList.contains(name)) return el;
        for (var i = 0; i < ch.length; i++) {
          if (ch[i].querySelector) {
            var found = ch[i].querySelector(sel);
            if (found) return found;
          }
        }
        return null;
      }
      // Support tagName selectors (e.g. 'video', 'img', 'div')
      var tag = sel.toUpperCase();
      if (el.tagName === tag) return el;
      for (var i = 0; i < ch.length; i++) {
        if (ch[i].querySelector) {
          var found = ch[i].querySelector(sel);
          if (found) return found;
        }
      }
      return null;
    },
    querySelectorAll: function (sel) {
      var results = [];
      if (!sel) return results;
      if (sel[0] === '.') {
        var name = sel.slice(1);
        if (el.classList.contains(name)) results.push(el);
      } else {
        var tag = sel.toUpperCase();
        if (el.tagName === tag) results.push(el);
      }
      for (var i = 0; i < ch.length; i++) {
        if (ch[i].querySelectorAll) {
          results = results.concat(ch[i].querySelectorAll(sel));
        }
      }
      return results;
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    getAttribute: function (k) {
      // Check dataset first, then direct properties
      if (el.dataset[k] !== undefined) return el.dataset[k];
      // Properties set directly on the element (e.g. el.src, el.href)
      var direct = el[k];
      if (direct !== undefined && direct !== null && typeof direct !== 'function' && typeof direct !== 'object') return String(direct);
      return null;
    },
    setAttribute: function (k, v) { el.dataset[k] = String(v); if (k === 'class') el.className = String(v); },
    removeAttribute: function (k) { delete el.dataset[k]; },
    getBoundingClientRect: function () { return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }; },
    get id() { return el.dataset._id || ''; },
    set id(v) { el.dataset._id = String(v); },
    get parentNode() { return el._parentEl || null; },
    get children() { return ch; },
    get firstChild() { return ch[0] || null; },
    get lastChild() { return ch[ch.length - 1] || null; },
    contains: function (other) {
      if (other === el) return true;
      for (var i = 0; i < ch.length; i++) {
        if (ch[i] === other) return true;
        if (ch[i].contains && ch[i].contains(other)) return true;
      }
      return false;
    },
    focus: function () {},
    blur: function () {},
    matches: function () { return false; },
    closest: function () { return null; },
  };
  return el;
}

// ---------------------------------------------------------------------------
// document
// ---------------------------------------------------------------------------
globalThis.document = {
  createElement: makeEl,
  createTextNode: function (t) { return { textContent: t, nodeType: 3, nodeName: '#text' }; },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {},
  removeEventListener: function () {},
  createDocumentFragment: function () { return makeEl('fragment'); },
  body: makeEl('body'),
  documentElement: makeEl('html'),
  readyState: 'complete',
  head: makeEl('head'),
  createComment: function () { return { nodeType: 8 }; },
};

// ---------------------------------------------------------------------------
// window, navigator, location (Node v26 has readonly getters for these)
// ---------------------------------------------------------------------------
globalThis.window = globalThis;
try { delete globalThis.navigator; } catch (e) { Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true }); }
try { delete globalThis.location; } catch (e) { Object.defineProperty(globalThis, 'location', { value: {}, configurable: true, writable: true }); }
globalThis.navigator = { userAgent: 'node', hardwareConcurrency: 4 };
globalThis.location = { hash: '', pathname: '/', search: '', href: 'http://localhost/', host: 'localhost', hostname: 'localhost', port: '', protocol: 'http:', origin: 'http://localhost' };

// ---------------------------------------------------------------------------
// requestAnimationFrame
// ---------------------------------------------------------------------------
globalThis.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); };
globalThis.cancelAnimationFrame = function (id) { clearTimeout(id); };

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------
var _store = {};
globalThis.localStorage = {
  getItem: function (k) { return _store[k] !== undefined ? _store[k] : null; },
  setItem: function (k, v) { _store[k] = String(v); },
  removeItem: function (k) { delete _store[k]; },
  clear: function () { _store = {}; },
  get length() { return Object.keys(_store).length; },
  key: function (i) { var keys = Object.keys(_store); return keys[i] || null; },
};

// ---------------------------------------------------------------------------
// matchMedia
// ---------------------------------------------------------------------------
globalThis.matchMedia = function () {
  return { matches: false, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () {} };
};

// ---------------------------------------------------------------------------
// YT API (used by removeOne)
// ---------------------------------------------------------------------------
globalThis.YT = {
  Player: function (elementId, opts) {
    this._elementId = elementId;
    this._opts = opts || {};
    this._state = -1;
    this.pauseVideo = function () {};
    this.destroy = function () {};
    this.getPlayerState = function () { return this._state; };
    this.loadVideoById = function () {};
    this.mute = function () {};
    this.unMute = function () {};
    if (this._opts.events && this._opts.events.onReady) {
      var self = this;
      setTimeout(function () { self._opts.events.onReady({ target: self }); }, 0);
    }
  },
  PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
};
globalThis.onYouTubeIframeAPIReady = null;

// ---------------------------------------------------------------------------
// IntersectionObserver (used in removeOne)
// ---------------------------------------------------------------------------
globalThis.IntersectionObserver = function (callback, options) {
  this._callback = callback;
  this._options = options || {};
  this._entries = [];
  this.observe = function (el) { this._entries.push(el); };
  this.unobserve = function (el) { var i = this._entries.indexOf(el); if (i !== -1) this._entries.splice(i, 1); };
  this.disconnect = function () { this._entries = []; };
};

// ---------------------------------------------------------------------------
// HTMLElement + Node (needed by some DOM-querying patterns)
// ---------------------------------------------------------------------------
globalThis.HTMLElement = function () {};
globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

// ---------------------------------------------------------------------------
// Now call preload — extract functions from comportamiento.js into globals
// ---------------------------------------------------------------------------
try {
  setupTestHooks();
} catch (err) {
  console.warn('[setup.js] setupTestHooks failed:', err.message);
}
