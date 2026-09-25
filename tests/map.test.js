const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTerrain } = require('../map.js');

test('terrain generation is deterministic for a seed and changes with a new seed', () => {
  const first = generateTerrain('forest', 'medium', 'abc');
  assert.deepEqual(first, generateTerrain('forest', 'medium', 'abc'));
  assert.notDeepEqual(first.terrain, generateTerrain('forest', 'medium', 'def').terrain);
});

test('all scenes and sizes produce bounded JSON terrain records', () => {
  const dimensions = { small: [900, 600], medium: [1200, 800], large: [1600, 1000] };
  for (const scene of ['forest', 'clearing', 'ruins', 'cave']) {
    for (const [size, [width, height]] of Object.entries(dimensions)) {
      const map = generateTerrain(scene, size, 'test');
      assert.equal(map.width, width); assert.equal(map.height, height);
      assert.ok(map.terrain.length > 10);
      assert.deepEqual(map.positions, {});
      for (const feature of map.terrain) {
        assert.ok(feature.x >= 0 && feature.x < width);
        assert.ok(feature.y >= 0 && feature.y < height);
        assert.ok(feature.r > 0);
        assert.ok(Number.isInteger(feature.rotation));
      }
      assert.deepEqual(JSON.parse(JSON.stringify(map)), map);
    }
  }
});
