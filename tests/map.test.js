const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTerrain } = require('../map.js');

test('terrain generation is deterministic for a seed and changes with a new seed', () => {
  for (const scene of ['forest', 'forest_clearing', 'forest_crossroads', 'road', 'river_ford', 'marsh', 'ravine', 'clearing', 'ruins', 'cave']) {
    const first = generateTerrain(scene, 'medium', 'abc');
    assert.deepEqual(first, generateTerrain(scene, 'medium', 'abc'), scene);
    assert.notDeepEqual(first.terrain, generateTerrain(scene, 'medium', 'def').terrain, scene);
  }
});

test('all scenes and sizes produce bounded JSON terrain records', () => {
  const dimensions = { small: [900, 900], medium: [1200, 1200], large: [1600, 1600] };
  for (const scene of ['forest', 'forest_clearing', 'forest_crossroads', 'road', 'river_ford', 'marsh', 'ravine', 'clearing', 'ruins', 'cave']) {
    for (const [size, [width, height]] of Object.entries(dimensions)) {
      const map = generateTerrain(scene, size, 'test');
      assert.equal(map.width, width); assert.equal(map.height, height);
      assert.ok(map.terrain.length > 10);
      assert.ok(map.terrain.length <= 1000, `${scene}/${size}`);
      assert.deepEqual(map.positions, {});
      for (const feature of map.terrain) {
        assert.ok(['tree', 'shrub', 'grass', 'log', 'boulder', 'rubble', 'wall', 'pillar', 'pool', 'crystal', 'stalagmite'].includes(feature.kind));
        assert.ok(feature.x >= 0 && feature.x < width);
        assert.ok(feature.y >= 0 && feature.y < height);
        assert.ok(feature.r > 0);
        assert.ok(Number.isInteger(feature.rotation));
      }
      for (const feature of map.features || []) {
        assert.ok(['trail', 'river', 'ford'].includes(feature.kind));
        assert.ok(Number.isInteger(feature.width) && feature.width > 0 && feature.width <= width);
        assert.ok(feature.points.length >= 2 && feature.points.length <= 64);
        for (const point of feature.points) {
          assert.ok(Number.isInteger(point.x) && point.x >= 0 && point.x < width);
          assert.ok(Number.isInteger(point.y) && point.y >= 0 && point.y < height);
        }
      }
      assert.deepEqual(JSON.parse(JSON.stringify(map)), map);
    }
  }
});

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
function distanceToPath(point, feature) {
  return Math.min(...feature.points.slice(1).map((end, i) => distanceToSegment(point, feature.points[i], end)));
}

test('wooded scenes are dense while their connected paths and central clearing stay open', () => {
  const forest = generateTerrain('forest', 'medium', 'shape');
  const clearing = generateTerrain('clearing', 'medium', 'shape');
  assert.ok(forest.terrain.filter(item => item.kind === 'tree').length > clearing.terrain.filter(item => item.kind === 'tree').length * 2);
  for (const scene of ['forest', 'forest_clearing', 'forest_crossroads', 'road', 'ravine']) {
    const map = generateTerrain(scene, 'large', 'shape');
    const trails = map.features.filter(feature => feature.kind === 'trail');
    assert.equal(trails.length, scene === 'forest_crossroads' ? 2 : 1, scene);
    for (const obstacle of map.terrain.filter(item => ['tree', 'shrub', 'boulder', 'log', 'rubble'].includes(item.kind))) {
      for (const trail of trails) assert.ok(distanceToPath(obstacle, trail) > trail.width / 2 + obstacle.r, scene);
    }
    if (scene === 'forest_crossroads') assert.deepEqual(trails[0].points[4], trails[1].points[4]);
  }
  const woodland = generateTerrain('forest_clearing', 'medium', 'shape');
  const center = { x: woodland.width / 2, y: woodland.height / 2 };
  assert.ok(woodland.terrain.every(item => item.kind !== 'tree' || Math.hypot(item.x - center.x, item.y - center.y) > woodland.width * .12));
});

test('river ford crosses the water and marsh has clustered pools', () => {
  const fordMap = generateTerrain('river_ford', 'medium', 'shape');
  const river = fordMap.features.find(feature => feature.kind === 'river');
  const ford = fordMap.features.find(feature => feature.kind === 'ford');
  const trails = fordMap.features.filter(feature => feature.kind === 'trail');
  assert.ok(river && ford && trails.length === 2);
  assert.deepEqual(ford.points[1], river.points[4]);
  assert.deepEqual(trails[0].points.at(-1), ford.points[0]);
  assert.deepEqual(trails[1].points[0], ford.points[2]);
  assert.ok(fordMap.terrain.every(item => distanceToPath(item, river) > river.width / 2 || item.kind === 'grass'));
  const marsh = generateTerrain('marsh', 'medium', 'shape');
  assert.ok(marsh.terrain.filter(item => item.kind === 'pool').length > 15);
});
