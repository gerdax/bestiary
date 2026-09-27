const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTerrain } = require('../map.js');

test('terrain generation is deterministic for a seed and changes with a new seed', () => {
  for (const scene of ['forest', 'forest_clearing', 'forest_crossroads', 'road', 'river', 'river_ford', 'marsh', 'ravine', 'clearing', 'ruins', 'cave']) {
    const first = generateTerrain(scene, 'medium', 'abc');
    assert.deepEqual(first, generateTerrain(scene, 'medium', 'abc'), scene);
    assert.notDeepEqual(first.terrain, generateTerrain(scene, 'medium', 'def').terrain, scene);
  }
});

test('all scenes and sizes produce bounded JSON terrain records', () => {
  const dimensions = { small: [900, 900], medium: [1200, 1200], large: [1600, 1600] };
  for (const scene of ['forest', 'forest_clearing', 'forest_crossroads', 'road', 'river', 'river_ford', 'marsh', 'ravine', 'clearing', 'ruins', 'cave']) {
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
  const forest = generateTerrain('forest', 'medium', '0');
  const clearing = generateTerrain('clearing', 'medium', 'shape');
  assert.ok(forest.terrain.filter(item => item.kind === 'tree').length > clearing.terrain.filter(item => item.kind === 'tree').length * 2);
  for (const scene of ['forest', 'forest_clearing', 'forest_crossroads', 'road', 'ravine']) {
    const map = generateTerrain(scene, 'large', '0');
    const trails = map.features.filter(feature => feature.kind === 'trail');
    assert.ok(trails.length <= (scene === 'forest_crossroads' ? 4 : scene === 'forest_clearing' ? 3 : 1), scene);
    for (const obstacle of map.terrain.filter(item => ['tree', 'shrub', 'boulder', 'log', 'rubble'].includes(item.kind))) {
      for (const trail of trails) assert.ok(distanceToPath(obstacle, trail) > trail.width / 2 + obstacle.r, scene);
    }
    if (scene === 'forest_crossroads') for (const trail of trails.slice(1)) assert.deepEqual(trails[0].points.at(-1), trail.points.at(-1));
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

function routeDirection(map) {
  const points = map.features.find(feature => feature.kind === 'trail').points;
  const start = points[0], end = points.at(-1);
  if (start.y === 0 && end.y === map.height - 1) return 'vertical';
  if (start.x === 0 && end.x === map.width - 1) return Math.abs(end.y - start.y) > map.height * .5 ? 'diagonal-right' : 'horizontal';
  if (start.x === map.width - 1 && end.x === 0) return 'diagonal-left';
  return 'invalid';
}
function ruinsLayout(map) {
  const trails = map.features.filter(feature => feature.kind === 'trail');
  return trails.length === 1 ? 'road' : trails.length === 3 ? 'plaza' : trails.length === 2 ? 'wall' : 'invalid';
}
function entranceSide(map, feature) {
  const point = feature.points[0];
  if (point.x === 0) return 'left';
  if (point.x === map.width - 1) return 'right';
  if (point.y === 0) return 'top';
  if (point.y === map.height - 1) return 'bottom';
  return 'invalid';
}

test('seeded variant families cover their intended structures in every size', () => {
  for (const size of ['small', 'medium', 'large']) {
    const seen = Object.fromEntries(['forest', 'forest_clearing', 'forest_crossroads', 'road', 'ravine', 'river', 'river_ford', 'ruins'].map(scene => [scene, new Set()]));
    for (let seed = 0; seed < 120; seed++) {
      for (const scene of Object.keys(seen)) {
        const map = generateTerrain(scene, size, String(seed));
        const trails = (map.features || []).filter(feature => feature.kind === 'trail');
        if (scene === 'forest') seen[scene].add(trails.length ? trails[0].width < map.width * .05 ? 'narrow' : 'wide' : 'none');
        else if (scene === 'forest_clearing') {
          assert.equal(new Set(trails.map(feature => entranceSide(map, feature))).size, trails.length);
          assert.ok(trails.every(feature => Math.hypot(feature.points.at(-1).x - map.width / 2, feature.points.at(-1).y - map.height / 2) < map.width * .12));
          seen[scene].add(trails.length);
        } else if (scene === 'forest_crossroads') {
          const junction = trails[0].points.at(-1);
          assert.ok(trails.every(feature => feature.points.at(-1).x === junction.x && feature.points.at(-1).y === junction.y));
          const angles = trails.map(feature => Math.atan2(feature.points[0].y - junction.y, feature.points[0].x - junction.x)).sort((a, b) => a - b);
          const gaps = angles.map((angle, index) => ((angles[(index + 1) % angles.length] - angle + Math.PI * 4) % (Math.PI * 2)));
          assert.ok(gaps.every(gap => Math.abs(gap - Math.PI * 2 / trails.length) < .06));
          seen[scene].add(trails.length);
        } else if (scene === 'road' || scene === 'ravine') seen[scene].add(routeDirection(map));
        else if (scene === 'river' || scene === 'river_ford') {
          const rivers = map.features.filter(feature => feature.kind === 'river');
          const fords = map.features.filter(feature => feature.kind === 'ford');
          assert.equal(rivers.length, 1);
          assert.equal(fords.length, scene === 'river_ford' ? 1 : 0);
          assert.equal(trails.length, scene === 'river_ford' ? 2 : 0);
          const rocks = map.terrain.filter(item => item.kind === 'boulder');
          assert.ok(rocks.every(item => distanceToPath(item, rivers[0]) > rivers[0].width / 2 + item.r));
          seen[scene].add(rocks.length);
        } else {
          assert.ok(map.terrain.length <= 1000);
          const layout = ruinsLayout(map);
          assert.notEqual(layout, 'invalid');
          assert.ok(map.terrain.filter(item => item.kind === 'wall').length >= 25);
          assert.ok(map.terrain.filter(item => item.kind === 'rubble').length >= 25);
          for (const record of map.terrain.filter(item => ['wall', 'pillar', 'rubble'].includes(item.kind))) {
            for (const trail of trails) assert.ok(distanceToPath(record, trail) > trail.width / 2 + record.r, `${size}/${seed}/${layout}`);
          }
          if (layout === 'road') {
            assert.ok(trails[0].width >= map.width * .1);
            assert.notEqual(routeDirection(map), 'invalid');
          } else if (layout === 'plaza') {
            const square = trails.find(feature => feature.width > map.width * .25);
            assert.ok(square && square.width > map.width * .3);
            assert.ok(trails.filter(feature => feature !== square).every(feature => distanceToPath(feature.points.at(-1), square) < square.width / 2));
            const center = square.points[0];
            assert.ok(map.terrain.filter(item => ['wall', 'pillar', 'rubble'].includes(item.kind)).every(item => Math.hypot(item.x - center.x, item.y - center.y) > square.width * .35));
          } else {
            const gates = trails.map(feature => feature.points[2]);
            const horizontal = Math.abs(gates[0].y - gates[1].y) < 5;
            const line = horizontal ? (gates[0].y + gates[1].y) / 2 : (gates[0].x + gates[1].x) / 2;
            const wallPieces = map.terrain.filter(item => item.kind === 'wall' && Math.abs((horizontal ? item.y : item.x) - line) < map.width * .04 && Math.abs(item.rotation - (horizontal ? 0 : 90)) < 1);
            assert.ok(wallPieces.length >= 8);
            assert.ok(Math.abs((horizontal ? gates[0].x : gates[0].y) - (horizontal ? gates[1].x : gates[1].y)) > map.width * .3);
          }
          seen[scene].add(layout);
        }
      }
    }
    assert.deepEqual([...seen.forest].sort(), ['narrow', 'none', 'wide']);
    assert.deepEqual([...seen.forest_clearing].sort(), [1, 2, 3]);
    assert.deepEqual([...seen.forest_crossroads].sort(), [3, 4]);
    for (const scene of ['road', 'ravine']) assert.deepEqual([...seen[scene]].sort(), ['diagonal-left', 'diagonal-right', 'horizontal', 'vertical']);
    for (const scene of ['river', 'river_ford']) assert.deepEqual([...seen[scene]].sort((a, b) => a - b), [4, 15, 22]);
    assert.deepEqual([...seen.ruins].sort(), ['plaza', 'road', 'wall']);
  }
});
