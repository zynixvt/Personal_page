/**
 * CSS will-change Audit — tests for Phase 6
 *
 * Phase 6 tasks:
 *   6.1 — Remove will-change: transform from .slide-in-up
 *   6.2 — Remove will-change: transform from .panel
 *   6.3 — Verify prefers-reduced-motion: reduce block still works
 *
 * These tests read estilo.css directly and verify the CSS content.
 * They are structural tests — no DOM rendering involved.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var cssPath = path.resolve(__dirname, '../../estilo.css');

function readCSS() {
  return fs.readFileSync(cssPath, 'utf-8');
}

describe('CSS will-change Audit (Phase 6)', function () {
  // ====================================================================
  // Task 6.1: .slide-in-up
  // ====================================================================

  describe('6.1 — .slide-in-up will-change removed', function () {
    it('should not have will-change in .slide-in-up rule', function () {
      var css = readCSS();
      // Find the .slide-in-up block and check it doesn't contain will-change
      var slideInUp = css.match(/\.slide-in-up\s*\{[\s\S]*?\}/);
      expect(slideInUp).not.toBeNull();
      expect(slideInUp[0].indexOf('will-change')).toBe(-1);
    });

    it('should still have animation property on .slide-in-up', function () {
      var css = readCSS();
      var slideInUp = css.match(/\.slide-in-up\s*\{[\s\S]*?\}/);
      expect(slideInUp).not.toBeNull();
      expect(slideInUp[0].indexOf('animation') !== -1).toBe(true);
    });
  });

  // ====================================================================
  // Task 6.2: .panel
  // ====================================================================

  describe('6.2 — .panel will-change removed', function () {
    it('should not have will-change in .panel rule', function () {
      var css = readCSS();
      // Find the .panel block (the one with contain:layout style paint, not .panel.active)
      var panelRules = css.match(/\.panel\s*\{[\s\S]*?\}/g);
      expect(panelRules).not.toBeNull();
      // Find the panel rule that has contain property (the main one, not .panel.active)
      var hasWillChange = false;
      panelRules.forEach(function (rule) {
        if (rule.indexOf('contain: layout style paint') !== -1) {
          hasWillChange = rule.indexOf('will-change') !== -1;
        }
      });
      expect(hasWillChange).toBe(false);
    });

    it('should still have transition property on .panel', function () {
      var css = readCSS();
      var panelRules = css.match(/\.panel\s*\{[\s\S]*?\}/g);
      expect(panelRules).not.toBeNull();
      var hasTransition = false;
      panelRules.forEach(function (rule) {
        if (rule.indexOf('contain: layout style paint') !== -1) {
          hasTransition = rule.indexOf('transition') !== -1;
        }
      });
      expect(hasTransition).toBe(true);
    });

    it('should still have contain property on .panel', function () {
      var css = readCSS();
      var panelRules = css.match(/\.panel\s*\{[\s\S]*?\}/g);
      expect(panelRules).not.toBeNull();
      var hasContain = false;
      panelRules.forEach(function (rule) {
        if (rule.indexOf('contain: layout style paint') !== -1) {
          hasContain = true;
        }
      });
      expect(hasContain).toBe(true);
    });
  });

  // ====================================================================
  // Task 6.3: prefers-reduced-motion
  // ====================================================================

  describe('6.3 — prefers-reduced-motion preserved', function () {
    it('should still have @media (prefers-reduced-motion: reduce) block', function () {
      var css = readCSS();
      var reducedMotionBlock = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/);
      expect(reducedMotionBlock).not.toBeNull();
    });

    it('should still nullify animation-duration inside reduced-motion', function () {
      var css = readCSS();
      var reducedMotionBlock = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/);
      expect(reducedMotionBlock).not.toBeNull();
      expect(reducedMotionBlock[0].indexOf('animation-duration') !== -1).toBe(true);
      expect(reducedMotionBlock[0].indexOf('0.01ms') !== -1).toBe(true);
    });

    it('should still nullify transition-duration inside reduced-motion', function () {
      var css = readCSS();
      var reducedMotionBlock = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/);
      expect(reducedMotionBlock).not.toBeNull();
      expect(reducedMotionBlock[0].indexOf('transition-duration') !== -1).toBe(true);
    });
  });
});
