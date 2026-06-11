/**
 * Spatial Grid — unit tests for ParticleSystem spatial hash grid
 *
 * Tests the pure-function `buildSpatialGrid` that maps particles to
 * 100px × 100px cells. The grid replaces O(n²) all-pairs in _draw()
 * with 3×3 cell-neighborhood lookups.
 *
 * Exposed via window.__test__.buildSpatialGrid(particles, cellSize).
 */

import './setup.js';
import { describe, it, expect, beforeAll } from 'vitest';

describe('buildSpatialGrid', function () {
  var buildSpatialGrid;

  beforeAll(function () {
    buildSpatialGrid = window.__test__.buildSpatialGrid;
  });

  it('should assign particle at (0, 0) to cell "0,0"', function () {
    var grid = buildSpatialGrid([{ x: 0, y: 0 }], 100);
    expect(grid['0,0']).toBeDefined();
    expect(grid['0,0']).toEqual([0]);
  });

  it('should assign particle at (150, 50) to cell "1,0"', function () {
    var grid = buildSpatialGrid([{ x: 150, y: 50 }], 100);
    expect(grid['1,0']).toBeDefined();
    expect(grid['1,0']).toEqual([0]);
  });

  it('should assign particle at (150, 150) to cell "1,1"', function () {
    var grid = buildSpatialGrid([{ x: 150, y: 150 }], 100);
    expect(grid['1,1']).toBeDefined();
    expect(grid['1,1']).toEqual([0]);
  });

  it('should use Math.floor so x=100,y=100 maps to cell "1,1"', function () {
    // Math.floor(100 / 100) = 1, not 0
    var grid = buildSpatialGrid([{ x: 100, y: 100 }], 100);
    expect(grid['1,1']).toBeDefined();
    expect(grid['0,0']).toBeUndefined();
  });

  it('should place multiple particles into the same cell', function () {
    var particles = [
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 90, y: 90 },
    ];
    var grid = buildSpatialGrid(particles, 100);
    expect(grid['0,0']).toBeDefined();
    expect(grid['0,0']).toHaveLength(3);
    expect(grid['0,0']).toEqual([0, 1, 2]);
  });

  it('should place particles in different cells based on coordinates', function () {
    var particles = [
      { x: 10, y: 10 },   // cell 0,0
      { x: 150, y: 10 },  // cell 1,0
      { x: 10, y: 150 },  // cell 0,1
      { x: 150, y: 150 }, // cell 1,1
    ];
    var grid = buildSpatialGrid(particles, 100);
    expect(grid['0,0']).toEqual([0]);
    expect(grid['1,0']).toEqual([1]);
    expect(grid['0,1']).toEqual([2]);
    expect(grid['1,1']).toEqual([3]);
  });

  it('should handle negative coordinates (wrap-around edges)', function () {
    var particles = [
      { x: -1, y: -1 },   // cell -1,-1
      { x: -100, y: -50 }, // cell -1,-1 (floor(-100/100)=-1, floor(-50/100)=-1)
    ];
    var grid = buildSpatialGrid(particles, 100);
    expect(grid['-1,-1']).toBeDefined();
    expect(grid['-1,-1']).toHaveLength(2);
  });

  it('should return empty object for empty particle array', function () {
    var grid = buildSpatialGrid([], 100);
    expect(Object.keys(grid)).toHaveLength(0);
  });

  it('should return correct cell keys for each index', function () {
    var particles = [
      { x: 250, y: 350 }, // cell 2,3
      { x: 50, y: 50 },   // cell 0,0
      { x: 450, y: 50 },  // cell 4,0
    ];
    var grid = buildSpatialGrid(particles, 100);
    expect(grid['2,3']).toEqual([0]);
    expect(grid['0,0']).toEqual([1]);
    expect(grid['4,0']).toEqual([2]);
  });

  it('should work with a different cellSize (50px)', function () {
    var particles = [
      { x: 30, y: 30 },   // cell 0,0
      { x: 60, y: 60 },   // cell 1,1
      { x: 120, y: 120 }, // cell 2,2
    ];
    var grid = buildSpatialGrid(particles, 50);
    expect(grid['0,0']).toEqual([0]);
    expect(grid['1,1']).toEqual([1]);
    expect(grid['2,2']).toEqual([2]);
  });

  it('should include every particle index exactly once across all cells', function () {
    var particles = [
      { x: 10, y: 10 },
      { x: 150, y: 10 },
      { x: 10, y: 150 },
      { x: 250, y: 250 },
    ];
    var grid = buildSpatialGrid(particles, 100);
    var allIndices = [];
    Object.keys(grid).forEach(function (key) {
      allIndices = allIndices.concat(grid[key]);
    });
    allIndices.sort(function (a, b) { return a - b; });
    expect(allIndices).toEqual([0, 1, 2, 3]);
  });
});
