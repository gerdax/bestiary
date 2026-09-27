/* Procedural encounter map. Terrain is stored as small JSON records in map pixels. */
(function (root) {
  'use strict';
  const SIZES = { small: [900, 900], medium: [1200, 1200], large: [1600, 1600] };
  const SCENES = { forest: 'Las', forest_clearing: 'Las z polaną', forest_crossroads: 'Leśne rozstaje', road: 'Trakt', river_ford: 'Rzeka z brodem', marsh: 'Bagna', ravine: 'Skalisty wąwóz', clearing: 'Polana', ruins: 'Ruiny', cave: 'Jaskinia' };
  const SVG = 'http://www.w3.org/2000/svg';
  const STANCES = ['Zapalczywa', 'Wyważona', 'Defensywna', 'Bezpieczna'];
  const polish = new Intl.Collator('pl');
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function randomFor(seed) {
    let h = 2166136261;
    for (const char of String(seed)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function distanceToSegment(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
  }
  function distanceToFeature(x, y, feature) {
    let distance = Infinity;
    for (let i = 1; i < feature.points.length; i++) distance = Math.min(distance, distanceToSegment(x, y, feature.points[i - 1], feature.points[i]));
    return distance;
  }
  function generateTerrain(scene = 'clearing', size = 'medium', seed = '1') {
    scene = SCENES[scene] ? scene : 'clearing';
    size = SIZES[size] ? size : 'medium';
    const [width, height] = SIZES[size], rng = randomFor(seed), terrain = [], features = [];
    const rand = (a, b) => Math.round(a + rng() * (b - a));
    const add = (kind, x, y, r, rotation = 0, variant = 0) => terrain.push({ kind, x: Math.round(x), y: Math.round(y), r: Math.round(r), rotation: Math.round(rotation), variant: Math.round(variant) });
    const addFeature = (kind, featureWidth, points) => {
      const feature = { kind, width: Math.round(featureWidth), points: points.map(([x, y]) => ({ x: clamp(Math.round(x), 0, width - 1), y: clamp(Math.round(y), 0, height - 1) })) };
      features.push(feature);
      return feature;
    };
    const route = (axis, centre, bend, sections = 8) => Array.from({ length: sections + 1 }, (_, i) => {
      const u = i / sections, across = u * (axis === 'x' ? width - 1 : height - 1);
      const wiggle = Math.sin(u * Math.PI * 2 + bend) * (axis === 'x' ? height : width) * .075 + Math.sin(u * Math.PI * 4 + bend * .7) * (axis === 'x' ? height : width) * .023;
      return axis === 'x' ? [across, centre + wiggle] : [centre + wiggle, across];
    });
    const clearOf = (x, y, r, kinds = ['trail', 'ford']) => features.every(feature => !kinds.includes(feature.kind) || distanceToFeature(x, y, feature) > feature.width / 2 + r + 6);
    const wooded = (target, allow) => {
      for (let i = 0, attempts = 0; i < target && attempts < target * 12; attempts++) {
        const x = rand(30, width - 30), y = rand(30, height - 30), r = rand(16, 32);
        if (!clearOf(x, y, r) || (allow && !allow(x, y, r))) continue;
        const choice = rng();
        add(choice < .76 ? 'tree' : choice < .91 ? 'shrub' : choice < .97 ? 'boulder' : 'log', x, y, r, rand(0, 359), rand(0, 3));
        i++;
      }
    };
    const count = Math.round(width * height / 10500);
    const newScene = ['forest', 'forest_clearing', 'forest_crossroads', 'road', 'river_ford', 'marsh', 'ravine'].includes(scene);
    if (newScene) {
      const axis = rng() < .5 ? 'x' : 'y', centre = (axis === 'x' ? height : width) * (.39 + rng() * .22), bend = rng() * Math.PI * 2;
      if (scene === 'forest') {
        addFeature('trail', Math.round(width * .045), route(axis, centre, bend));
        wooded(Math.round(count * 2.6));
      } else if (scene === 'forest_clearing') {
        const cx = width * (.43 + rng() * .14), cy = height * (.43 + rng() * .14);
        const path = route(axis, axis === 'x' ? cy : cx, bend).slice(0, 5);
        path[path.length - 1] = [cx, cy];
        addFeature('trail', Math.round(width * .05), path);
        const rx = width * (.19 + rng() * .04), ry = height * (.17 + rng() * .05);
        wooded(Math.round(count * 2.7), (x, y, r) => Math.hypot((x - cx) / (rx + r), (y - cy) / (ry + r)) > 1);
        for (let i = 0; i < count * .24; i++) add('grass', rand(cx - rx * .7, cx + rx * .7), rand(cy - ry * .7, cy + ry * .7), rand(7, 15), rand(0, 359), rand(0, 3));
      } else if (scene === 'forest_crossroads') {
        const crossX = width * (.42 + rng() * .16), crossY = height * (.42 + rng() * .16);
        const main = route(axis, axis === 'x' ? crossY : crossX, bend);
        main[4] = [crossX, crossY];
        addFeature('trail', Math.round(width * .05), main);
        const branch = route(axis === 'x' ? 'y' : 'x', axis === 'x' ? crossX : crossY, bend + 1.3);
        branch[4] = [crossX, crossY];
        addFeature('trail', Math.round(width * .045), branch);
        wooded(Math.round(count * 2.7));
      } else if (scene === 'road') {
        addFeature('trail', Math.round(width * .11), route(axis, centre, bend));
        for (let i = 0; i < count * 1.25; i++) {
          const x = rand(24, width - 24), y = rand(24, height - 24), r = rand(10, 27);
          if (!clearOf(x, y, r + 12)) continue;
          const choice = rng(); add(choice < .43 ? 'grass' : choice < .75 ? 'shrub' : choice < .9 ? 'tree' : 'boulder', x, y, r, rand(0, 359), rand(0, 3));
        }
      } else if (scene === 'river_ford') {
        const river = addFeature('river', Math.round(width * .12), route(axis, centre, bend));
        const crossing = river.points[4];
        const other = axis === 'x' ? 'y' : 'x';
        const approach = route(other, axis === 'x' ? crossing.x : crossing.y, bend + 1.8);
        approach[4] = [crossing.x, crossing.y];
        addFeature('trail', Math.round(width * .055), approach.slice(0, 4));
        addFeature('trail', Math.round(width * .055), approach.slice(5));
        addFeature('ford', Math.round(width * .075), [approach[3], approach[4], approach[5]]);
        for (let i = 0; i < count * 1.2; i++) {
          const x = rand(25, width - 25), y = rand(25, height - 25), r = rand(10, 29);
          if (distanceToFeature(x, y, river) < river.width / 2 + r + 5 || !clearOf(x, y, r)) continue;
          const choice = rng(); add(choice < .46 ? 'grass' : choice < .77 ? 'shrub' : choice < .91 ? 'tree' : 'boulder', x, y, r, rand(0, 359), rand(0, 3));
        }
      } else if (scene === 'marsh') {
        const clusters = Array.from({ length: 6 }, () => ({ x: rand(width * .15, width * .85), y: rand(height * .15, height * .85) }));
        for (let i = 0; i < count * 1.7; i++) {
          const cluster = clusters[rand(0, clusters.length - 1)], x = clamp(Math.round(cluster.x + (rng() + rng() + rng() - 1.5) * width * .28), 30, width - 30), y = clamp(Math.round(cluster.y + (rng() + rng() + rng() - 1.5) * height * .28), 30, height - 30);
          const choice = rng(); add(choice < .28 ? 'pool' : choice < .69 ? 'grass' : choice < .94 ? 'shrub' : 'log', x, y, rand(8, 30), rand(0, 359), rand(0, 3));
        }
      } else if (scene === 'ravine') {
        const corridor = addFeature('trail', Math.round(width * .12), route(axis, centre, bend));
        for (let i = 0; i < count * 2.6; i++) {
          const x = rand(24, width - 24), y = rand(24, height - 24), r = rand(13, 37);
          const distance = distanceToFeature(x, y, corridor);
          if (distance < corridor.width / 2 + r + 5) continue;
          const choice = rng(); add(choice < .68 ? 'boulder' : choice < .9 ? 'rubble' : 'grass', x, y, r, rand(0, 359), rand(0, 3));
        }
      }
      return { scene, size, seed: String(seed), width, height, terrain, features, positions: {} };
    }
    for (let i = 0; i < count; i++) {
      const x = rand(28, width - 28), y = rand(28, height - 28);
      if (scene === 'forest') {
        const choice = rng();
        add(choice < .62 ? 'tree' : choice < .79 ? 'shrub' : choice < .91 ? 'boulder' : 'log', x, y, rand(13, 36), rand(0, 359), rand(0, 3));
      } else if (scene === 'clearing') {
        const distance = Math.hypot((x - width / 2) / (width * .45), (y - height / 2) / (height * .44));
        if (distance > .65 && rng() < .7) add(rng() < .78 ? 'tree' : 'shrub', x, y, rand(15, 34), rand(0, 359), rand(0, 3));
        else add(rng() < .78 ? 'grass' : 'boulder', x, y, rand(8, 17), rand(0, 359), rand(0, 3));
      } else if (scene === 'ruins') {
        const choice = rng();
        add(choice < .3 ? 'wall' : choice < .57 ? 'rubble' : choice < .72 ? 'pillar' : choice < .88 ? 'grass' : 'boulder', x, y, rand(12, 38), rand(0, 3) * 90, rand(0, 3));
      } else {
        const choice = rng();
        add(choice < .38 ? 'boulder' : choice < .68 ? 'stalagmite' : choice < .85 ? 'crystal' : 'pool', x, y, rand(10, 33), rand(0, 359), rand(0, 3));
      }
    }
    return { scene, size, seed: String(seed), width, height, terrain, positions: {} };
  }
  if (typeof module === 'object' && module.exports) module.exports = { generateTerrain, randomFor };
  if (!root || !root.document) return;
  const doc = root.document, store = root.OneRingStore, section = doc.getElementById('map');
  if (!section || !store) return;
  let currentMap = null, selected = null, zoom = 1, offsetX = 0, offsetY = 0, fittedKey = '', gesture = null;
  const touchPoints = new Map();
  let touchLocked = false, touchGesture = null, suppressTouchClick = false;
  const el = (tag, className, textValue) => { const node = doc.createElement(tag); if (className) node.className = className; if (textValue != null) node.textContent = textValue; return node; };
  const svg = (tag, attrs, parent) => { const node = doc.createElementNS(SVG, tag); Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value))); if (parent) parent.appendChild(node); return node; };
  section.innerHTML = '<div class="section-heading map-heading"><h2>Potyczka</h2><div class="map-heading-actions"><button type="button" class="text-button" id="map-add-heroes">Dodaj bohaterów</button><button type="button" class="text-button" id="map-clear">Wyczyść potyczkę</button></div></div><div class="map-toolbar paper"><label>Sceneria<select id="map-scene"></select></label><label>Rozmiar<select id="map-size"><option value="small">Mały</option><option value="medium" selected>Średni</option><option value="large">Duży</option></select></label><button class="primary" id="map-generate" type="button">Wygeneruj mapę</button></div><p class="map-error" id="map-error" role="alert" hidden></p><div class="map-layout"><div class="map-viewport" id="map-viewport" aria-label="Mapa starcia"><div class="map-stage" id="map-stage"><svg id="map-terrain" aria-hidden="true"></svg><div id="map-tokens"></div></div><div class="map-blank" id="map-blank"><span>✦</span><p>Wybierz scenerię i rozmiar, aby utworzyć mapę.</p></div><div class="map-zoom-controls map-center-controls"><button type="button" id="map-center" aria-label="Wyśrodkuj na aktywnej postaci" title="Wyśrodkuj na aktywnej postaci" disabled><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/></svg></button></div><div class="map-zoom-controls" role="group" aria-label="Powiększenie mapy"><button type="button" id="map-fit">Dopasuj</button><button type="button" id="map-zoom-out" aria-label="Pomniejsz mapę">−</button><button type="button" id="map-zoom-in" aria-label="Powiększ mapę">+</button></div></div><aside class="map-panel paper" id="map-panel" aria-live="polite"></aside></div>';
  const sceneInput = doc.getElementById('map-scene'), sizeInput = doc.getElementById('map-size');
  for (const [value, label] of Object.entries(SCENES)) { const option = doc.createElement('option'); option.value = value; option.textContent = label; sceneInput.appendChild(option); }
  sceneInput.value = 'clearing';
  const generateButton = doc.getElementById('map-generate'), viewport = doc.getElementById('map-viewport'), stage = doc.getElementById('map-stage');
  const terrainSvg = doc.getElementById('map-terrain'), tokens = doc.getElementById('map-tokens'), panel = doc.getElementById('map-panel'), blank = doc.getElementById('map-blank'), errorBox = doc.getElementById('map-error');
  function run(action) { try { action(); errorBox.hidden = true; } catch (error) { errorBox.textContent = error && error.message ? error.message : 'Nie udało się zapisać zmiany mapy.'; errorBox.hidden = false; } }
  function shape(record, parent) {
    if (!record || !Number.isFinite(record.x) || !Number.isFinite(record.y) || !Number.isFinite(record.r)) return;
    const { kind, x, y } = record, r = clamp(record.r, 3, 100), angle = record.rotation || 0, v = record.variant || 0;
    const g = svg('g', { transform: `translate(${x} ${y}) rotate(${angle})`, class: `terrain-${kind}` }, parent);
    const circle = (cx, cy, cr, fill, stroke = 'none', sw = 1) => svg('circle', { cx, cy, r: cr, fill, stroke, 'stroke-width': sw }, g);
    const path = (d, fill, stroke = 'none', sw = 1) => svg('path', { d, fill, stroke, 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    if (kind === 'tree') { circle(3, 5, r, '#394f38', '#253c30', 2); circle(-r * .26, -r * .2, r * .72, ['#56734d', '#4f6847', '#617b52', '#496644'][v % 4]); circle(r * .25, r * .13, r * .61, '#66815b'); circle(-r * .28, -r * .31, r * .32, '#829573'); }
    else if (kind === 'shrub') { circle(0, 0, r, '#536c49'); circle(-r * .38, -r * .3, r * .63, '#78905e'); circle(r * .37, r * .15, r * .55, '#6c8654'); }
    else if (kind === 'grass') { for (let i = -1; i <= 1; i++) path(`M${i * r * .4} ${r * .5} q${-r * .16} ${-r * .6} ${i * r * .2} ${-r}`, 'none', '#80936c', 2); }
    else if (kind === 'log') { path(`M${-r} ${-r * .23} L${r} ${-r * .23} Q${r * 1.2} 0 ${r} ${r * .23} L${-r} ${r * .23}Z`, '#765b43', '#4f4437', 2); path(`M${-r * .7} 0 L${r * .7} 0`, 'none', '#ad8c63', 2); }
    else if (kind === 'boulder' || kind === 'rubble') { path(`M${-r} ${r * .2} L${-r * .5} ${-r * .8} L${r * .4} ${-r} L${r} ${-r * .13} L${r * .65} ${r * .75} L${-r * .45} ${r}Z`, kind === 'rubble' ? '#9f9985' : '#84887a', '#625e50', 2); path(`M${-r * .5} ${-r * .8} L0 ${-r * .15} L${r * .65} ${r * .75}`, 'none', '#c0b9a3', 2); }
    else if (kind === 'wall') { svg('rect', { x: -r * 1.6, y: -r * .38, width: r * 3.2, height: r * .76, rx: 3, fill: '#807b68', stroke: '#575747', 'stroke-width': 2 }, g); for (let i = -1; i <= 1; i++) path(`M${i * r} ${-r * .38} V${r * .38}`, 'none', '#b5ac91', 2); }
    else if (kind === 'pillar') { circle(3, 4, r, '#67695c'); circle(0, 0, r * .83, '#a7a28b', '#67695c', 2); circle(0, 0, r * .52, '#bcb7a0', '#807a69', 2); }
    else if (kind === 'pool') { svg('ellipse', { cx: 0, cy: 0, rx: r * 1.4, ry: r * .75, fill: '#536c69', stroke: '#84918a', 'stroke-width': 3 }, g); path(`M${-r * .7} 0 q${r} ${-r * .5} ${r * 1.7} 0`, 'none', '#91aaa1', 2); }
    else if (kind === 'crystal' || kind === 'stalagmite') { const fill = kind === 'crystal' ? '#86a79e' : '#78766a'; path(`M${-r * .75} ${r * .65} L${-r * .3} ${-r * .5} L0 ${-r} L${r * .48} ${-r * .28} L${r * .75} ${r * .7}Z`, fill, '#505f59', 2); path(`M0 ${-r} L0 ${r * .7}`, 'none', '#b2beb0', 2); }
    else g.remove();
  }
  function paintTerrain(map) {
    terrainSvg.replaceChildren();
    terrainSvg.setAttribute('viewBox', `0 0 ${map.width} ${map.height}`);
    terrainSvg.setAttribute('width', map.width); terrainSvg.setAttribute('height', map.height);
    const scene = SCENES[map.scene] ? map.scene : 'clearing';
    svg('rect', { width: map.width, height: map.height, fill: { forest: '#a2aa80', forest_clearing: '#a2aa80', forest_crossroads: '#a2aa80', road: '#aaad87', river_ford: '#a7ae89', marsh: '#899b7d', ravine: '#9b9986', clearing: '#b9bd91', ruins: '#afa997', cave: '#777a71' }[scene] }, terrainSvg);
    const rng = randomFor(map.seed + '-ground');
    for (let i = 0; i < Math.round(map.width * map.height / 4500); i++) {
      svg('ellipse', { cx: Math.round(rng() * map.width), cy: Math.round(rng() * map.height), rx: Math.round(12 + rng() * 55), ry: Math.round(5 + rng() * 22), fill: scene === 'cave' ? '#8e8e7c' : '#ddd1a2', opacity: scene === 'ruins' ? .12 : .16, transform: `rotate(${Math.round(rng() * 180)} ${Math.round(rng() * map.width)} ${Math.round(rng() * map.height)})` }, terrainSvg);
    }
    const features = Array.isArray(map.features) ? map.features : [];
    for (const kind of ['river', 'trail', 'ford']) {
      for (const feature of features) {
        if (!feature || feature.kind !== kind || !Array.isArray(feature.points) || feature.points.length < 2 || !Number.isFinite(feature.width)) continue;
        const points = feature.points.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y));
        if (points.length < 2) continue;
        const d = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
        const base = { d, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
        const className = `map-feature map-feature-${kind}`;
        if (kind === 'river') {
          svg('path', { ...base, class: className, stroke: '#617d78', 'stroke-width': feature.width + 10 }, terrainSvg);
          svg('path', { ...base, stroke: '#648f93', 'stroke-width': feature.width }, terrainSvg);
          svg('path', { ...base, stroke: '#a4bdb1', 'stroke-width': Math.max(3, feature.width * .08), opacity: .58 }, terrainSvg);
        } else if (kind === 'ford') {
          svg('path', { ...base, class: className, stroke: '#62685e', 'stroke-width': feature.width + 8 }, terrainSvg);
          svg('path', { ...base, stroke: '#b6ad91', 'stroke-width': feature.width }, terrainSvg);
          svg('path', { ...base, stroke: '#dbcfab', 'stroke-width': Math.max(3, feature.width * .19), opacity: .65, 'stroke-dasharray': '8 13' }, terrainSvg);
        } else {
          const road = scene === 'road', rock = scene === 'ravine';
          svg('path', { ...base, class: className, stroke: road ? '#8d8265' : rock ? '#797667' : '#80795e', 'stroke-width': feature.width + (road ? 17 : 10) }, terrainSvg);
          svg('path', { ...base, stroke: road ? '#c8b88b' : rock ? '#b4ae94' : '#b5a77e', 'stroke-width': feature.width }, terrainSvg);
          if (road) svg('path', { ...base, stroke: '#e0cf9c', 'stroke-width': Math.max(3, feature.width * .09), opacity: .6 }, terrainSvg);
        }
      }
    }
    map.terrain.forEach(record => shape(record, terrainSvg));
    svg('rect', { x: 3, y: 3, width: map.width - 6, height: map.height - 6, fill: 'none', stroke: '#4f493a', 'stroke-width': 6, opacity: .55 }, terrainSvg);
  }
  function displayNames(participants) {
    return participants.map(p => String(p.name || p.kind || (p.type === 'hero' ? 'Bohater' : 'Przeciwnik')));
  }
  function displayedStance(value) { return value === 'Ostrożna' ? 'Defensywna' : STANCES.includes(value) ? value : 'Wyważona'; }
  function cycleParticipants(participants, names, person, direction) {
    const peers = participants.map((participant, index) => ({ participant, name: names[index] })).filter(item => item.participant.type === person.type);
    peers.sort((a, b) => {
      if (person.type === 'hero') {
        const difference = STANCES.indexOf(displayedStance(a.participant.stance)) - STANCES.indexOf(displayedStance(b.participant.stance));
        if (difference) return difference;
      }
      return polish.compare(a.name, b.name) || String(a.participant.id).localeCompare(String(b.participant.id));
    });
    const index = peers.findIndex(item => item.participant.id === person.id);
    return peers[(index + direction + peers.length) % peers.length].participant.id;
  }
  function saveHeroField(person, control, field, value) {
    const start = control.selectionStart, end = control.selectionEnd;
    run(() => store.saveHero({ id: person.heroId, [field]: value }));
    const replacement = Array.from(panel.querySelectorAll('[name]')).find(node => node.name === field);
    if (replacement) {
      replacement.focus();
      if (start != null && end != null && replacement.setSelectionRange) replacement.setSelectionRange(start, end);
    }
  }
  function renderTokens(map, participants) {
    tokens.replaceChildren();
    const names = displayNames(participants);
    participants.forEach((person, index) => {
      const pos = map.positions[person.id]; if (!pos) return;
      const marker = el('button', 'map-token ' + (person.type === 'hero' ? 'hero-token' : 'enemy-token') + (person.defeated ? ' is-defeated' : '') + (selected === person.id ? ' is-selected' : ''));
      marker.type = 'button'; marker.dataset.id = person.id; marker.style.left = clamp(pos.x, 30, map.width - 30) + 'px'; marker.style.top = clamp(pos.y, 30, map.height - 30) + 'px';
      marker.setAttribute('aria-label', `${names[index]}, ${person.type === 'hero' ? 'bohater' : 'przeciwnik'}${person.defeated ? ', pokonany' : ''}. Strzałki przesuwają znacznik.`);
      const symbol = el('span', 'map-token-symbol', person.type === 'hero' ? '✦' : '◆'); const label = el('span', 'map-token-label', names[index]); marker.append(symbol, label); tokens.appendChild(marker);
    });
  }
  function addAdjuster(container, id, field, value, max, title) {
    const box = el('div', 'map-resource'); box.dataset.field = field; box.appendChild(el('span', '', title));
    const controls = el('div', 'map-resource-controls'), minus = el('button', '', '−'), number = el('strong', '', `${value ?? 0} / ${max ?? 0}`), plus = el('button', '', '+');
    minus.type = plus.type = 'button'; minus.setAttribute('aria-label', `Zmniejsz ${title.toLowerCase()}`); plus.setAttribute('aria-label', `Zwiększ ${title.toLowerCase()}`);
    for (const [button, delta] of [[minus, -1], [plus, 1]]) button.addEventListener('click', () => {
      run(() => store.adjustResource(id, field, delta));
      const replacement = Array.from(panel.querySelectorAll('.map-resource')).find(node => node.dataset.field === field);
      if (replacement) replacement.querySelector(delta < 0 ? 'button:first-child' : 'button:last-child').focus();
    });
    controls.append(minus, number, plus); box.appendChild(controls); container.appendChild(box);
  }
  const heroSheetHost = el('div', 'map-hero-sheet');
  heroSheetHost.id = 'map-hero-sheet';
  heroSheetHost.hidden = true;
  section.append(heroSheetHost);
  const heroSheet = root.OneRingHeroSheet.mount(heroSheetHost);
  const enemyDetails = el('details', 'sheet-disclosure map-enemy-details');
  enemyDetails.id = 'map-enemy-details';
  enemyDetails.hidden = true;
  const enemyDetailBody = el('div', 'map-enemy-detail-body');
  enemyDetails.append(el('summary', '', 'Biegłości bojowe i Atrybuty'), enemyDetailBody);
  section.appendChild(enemyDetails);
  let detailEnemyId = null;
  const lastSelectedByType = { hero: null, enemy: null };
  function renderPanel(participants) {
    doc.getElementById('map-center').disabled = !currentMap || !participants.some(person => person.id === selected);
    const selectedHero = participants.find(p => p.id === selected && p.type === "hero");
    heroSheet.show(!store.loadError && currentMap && selectedHero ? selectedHero.heroId : null);
    enemyDetails.hidden = true;
    panel.replaceChildren();
    panel.classList.remove('is-defeated');
    if (store.loadError) { panel.append(el('p', 'eyebrow', 'BŁĄD ZAPISU'), el('h3', '', 'Nie można wczytać danych'), el('p', 'map-panel-help', 'Przywróć poprawną kopię zapasową, aby ponownie korzystać z mapy.')); return; }
    if (!currentMap) { panel.append(el('p', 'eyebrow', 'UCZESTNICY'), el('p', 'map-panel-help', 'Stwórz mapę, by zobaczyć dodanych uczestników')); return; }
    if (!participants.length) { panel.append(el('p', 'eyebrow', 'UCZESTNICY'), el('h3', '', 'Pusta mapa'), el('p', 'map-panel-help', 'Dodaj bohatera lub przeciwnika do aktywnej walki.')); return; }
    const names = displayNames(participants), index = participants.findIndex(p => p.id === selected), person = participants[index];
    if (!person) { panel.append(el('p', 'eyebrow', 'UCZESTNICY'), el('p', 'map-panel-help', 'Dotknij znacznika postaci na mapie, aby zobaczyć zasoby i działania.')); return; }
    panel.classList.toggle('is-defeated', !!person.defeated);
    const heading = el('div', 'map-panel-heading');
    const previous = el('button', 'map-cycle-prev', '‹'), next = el('button', 'map-cycle-next', '›');
    const typeName = person.type === 'hero' ? 'bohater' : 'przeciwnik';
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', `Poprzedni ${typeName}`);
    next.setAttribute('aria-label', `Następny ${typeName}`);
    const peerCount = participants.filter(p => p.type === person.type).length;
    previous.disabled = next.disabled = peerCount < 2;
    for (const [button, direction] of [[previous, -1], [next, 1]]) button.addEventListener('click', () => {
      selected = cycleParticipants(participants, names, person, direction);
      renderTokens(currentMap, participants);
      renderPanel(participants);
      const replacement = panel.querySelector(direction < 0 ? '.map-cycle-prev' : '.map-cycle-next');
      if (replacement) replacement.focus();
    });
    const navigation = el('div', 'map-panel-navigation'); navigation.append(previous, next);
    lastSelectedByType[person.type] = person.id;
    const otherType = person.type === 'hero' ? 'enemy' : 'hero';
    const otherParticipants = participants.filter(item => item.type === otherType);
    const switchType = el('button', 'eyebrow map-switch-type', person.type === 'hero' ? 'BOHATER' : 'PRZECIWNIK');
    switchType.type = 'button';
    switchType.title = person.type === 'hero' ? 'Przełącz na przeciwnika' : 'Przełącz na bohatera';
    switchType.setAttribute('aria-label', switchType.title);
    switchType.disabled = !otherParticipants.length;
    switchType.addEventListener('click', () => {
      const target = otherParticipants.find(item => item.id === lastSelectedByType[otherType]) || otherParticipants[0];
      if (!target) return;
      selectParticipant(target.id);
      panel.querySelector('.map-switch-type').focus();
    });
    heading.append(switchType, navigation);
    panel.append(heading, el('h3', '', names[index]));
    if (person.type === 'enemy' && person.distinctiveFeatures) panel.appendChild(el('p', 'map-enemy-features', person.distinctiveFeatures));
    if (person.type === 'hero') {
      const stanceLabel = el('label', 'map-panel-stance', 'Postawa');
      const stance = el('select'); stance.name = 'stance';
      STANCES.forEach(value => { const option = el('option', '', value); option.value = value; stance.appendChild(option); });
      stance.value = displayedStance(person.stance);
      stance.addEventListener('change', () => saveHeroField(person, stance, 'stance', stance.value));
      stanceLabel.appendChild(stance); panel.appendChild(stanceLabel);
    }
    const resources = el('div', 'map-resources'); addAdjuster(resources, person.id, 'endurance', person.endurance, person.maxEndurance, 'Wytrzymałość');
    if (person.type === 'hero') addAdjuster(resources, person.id, 'hope', person.hope, person.maxHope, 'Nadzieja');
    else addAdjuster(resources, person.id, 'hate', person.hate, person.maxHate, person.resourceType === 'determination' ? 'Determinacja' : 'Nienawiść');
    panel.appendChild(resources);
    const facts = el('div', 'map-panel-facts map-panel-hero-facts');
    const factValues = person.type === 'hero' ? [['Obrona', person.parry], ['Pancerz', person.armour], ['Obciąż.', person.load], ['Cień', person.shadow]] : [['Zajadł.', person.fierceness], ['Potęga', person.might], ['Obrona', person.parry], ['Pancerz', person.armour]];
    for (const [label, value] of factValues) { const fact = el('div'); fact.append(el('span', '', label), el('strong', '', value ?? '—')); facts.appendChild(fact); }
    panel.appendChild(facts);

    if (person.type === 'hero') {
      const conditions = el('div', 'map-panel-conditions');
      for (const [label, field] of [['Wyczerpanie', 'weary'], ['Przygnębienie', 'miserable'], ['Rana', 'wounded']]) {
        const wrapper = el('label'), input = el('input'); input.type = 'checkbox'; input.name = field; input.checked = !!person[field];
        input.addEventListener('change', () => saveHeroField(person, input, field, input.checked));
        wrapper.append(input, doc.createTextNode(label)); conditions.appendChild(wrapper);
      }
      const injuryLabel = el('label', 'map-panel-injury', 'Stopień rany'), injury = el('input');
      injury.type = 'text'; injury.name = 'injury'; injury.disabled = !person.wounded; injury.value = person.wounded ? person.injury || '' : '';
      injury.addEventListener('input', event => { if (!event.isComposing) saveHeroField(person, injury, 'injury', injury.value); });
      injury.addEventListener('compositionend', () => saveHeroField(person, injury, 'injury', injury.value));
      injuryLabel.appendChild(injury); panel.append(conditions, injuryLabel);
    } else {
      const wounds = el('div', 'map-enemy-wounds');
      wounds.setAttribute('role', 'group'); wounds.setAttribute('aria-label', 'Rany przeciwnika');
      wounds.appendChild(el('span', '', 'Rana:'));
      Array.from({ length: Math.max(4, (person.wounds || []).length) }, (_, index) => {
        const checked = !!person.wounds?.[index];
        const input = el('input'); input.type = 'checkbox'; input.checked = checked;
        input.disabled = index >= (person.wounds || []).length;
        input.dataset.wound = index;
        input.setAttribute('aria-label', input.disabled ? `Rana ${index + 1} — niedostępna` : `Rana ${index + 1} z ${person.wounds.length}`);
        input.addEventListener('change', () => {
          run(() => store.setEnemyWound(person.id, index, input.checked));
          const replacement = panel.querySelector(`[data-wound="${index}"]`);
          if (replacement) replacement.focus();
        });
        wounds.appendChild(input);
      });
      panel.appendChild(wounds);
      if (detailEnemyId !== person.id) enemyDetails.open = false;
      detailEnemyId = person.id;
      enemyDetails.hidden = false;
      enemyDetailBody.replaceChildren();
      for (const [label, value] of [['Biegłości bojowe', person.attack], ['Atrybuty', person.traits]]) {
        const block = el('div');
        block.append(el('h3', '', label), el('p', 'map-panel-detail', value || '—'));
        enemyDetailBody.appendChild(block);
      }
    }
    const defeated = el('button', 'map-panel-action', person.defeated ? 'Przywróć do walki' : person.type === 'hero' ? 'Nieprzytomny / konający' : 'Oznacz jako pokonanego');
    defeated.type = 'button'; defeated.addEventListener('click', () => { run(() => store.toggleDefeated(person.id)); const replacement = panel.querySelector('.map-panel-action'); if (replacement) replacement.focus(); }); panel.appendChild(defeated);
    const remove = el('button', 'map-panel-remove', 'Usuń z potyczki'); remove.type = 'button'; remove.addEventListener('click', () => { if (root.confirm(`Usunąć ${names[index]} z potyczki?`)) run(() => store.removeParticipant(person.id)); }); panel.appendChild(remove);
  }
  function transform() { stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`; }
  function fit() { if (!currentMap || !viewport.clientWidth || !viewport.clientHeight) return; zoom = clamp(Math.min((viewport.clientWidth - 24) / currentMap.width, (viewport.clientHeight - 24) / currentMap.height), .1, 2.5); offsetX = (viewport.clientWidth - currentMap.width * zoom) / 2; offsetY = (viewport.clientHeight - currentMap.height * zoom) / 2; transform(); }
  function zoomAt(factor, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) { if (!currentMap) return; const next = clamp(zoom * factor, .1, 3); offsetX = x - (x - offsetX) * next / zoom; offsetY = y - (y - offsetY) * next / zoom; zoom = next; transform(); }
  function refresh(snapshot) {
    const map = snapshot.map, participants = store.getParticipants();
    if (selected && !participants.some(p => p.id === selected)) selected = null;
    const key = map ? JSON.stringify([map.seed, map.scene, map.size, map.width, map.height, map.terrain, map.features]) : '';
    const terrainChanged = key !== fittedKey;
    if (terrainChanged) { gesture = null; touchPoints.clear(); touchGesture = null; touchLocked = false; }
    currentMap = map;
    blank.hidden = !!map; stage.hidden = !map;
    generateButton.textContent = 'Wygeneruj mapę'; generateButton.disabled = !!store.loadError;
    if (store.loadError) { errorBox.textContent = 'Nie można zapisać mapy: zapisane dane są uszkodzone. Przywróć poprawną kopię zapasową.'; errorBox.hidden = false; } else { errorBox.hidden = true; }
    if (map) {
      if (terrainChanged) { sceneInput.value = SCENES[map.scene] ? map.scene : 'clearing'; sizeInput.value = SIZES[map.size] ? map.size : 'medium'; }
      stage.style.width = map.width + 'px'; stage.style.height = map.height + 'px';
      if (terrainChanged) { paintTerrain(map); fittedKey = key; root.requestAnimationFrame(fit); }
      renderTokens(map, participants);
    } else { fittedKey = ''; tokens.replaceChildren(); }
    renderPanel(participants);
  }
  doc.getElementById('map-add-heroes').addEventListener('click', () => run(() => {
    const snapshot = store.getState();
    const participating = new Set(snapshot.heroParticipants.map(p => p.heroId));
    snapshot.heroes.filter(hero => !participating.has(hero.id)).forEach(hero => store.addHero(hero.id));
  }));
  doc.getElementById('map-clear').addEventListener('click', () => {
    if (root.confirm('Wyczyścić potyczkę? Mapa i wszyscy uczestnicy zostaną usunięci z potyczki. Arkusze bohaterów i biblioteka pozostaną zachowane.')) run(() => store.clearEncounter());
  });
  generateButton.addEventListener('click', () => {
    if (currentMap && !root.confirm('Wygenerować nową mapę? Rozstawienie znaczników zostanie wyzerowane.')) return;
    const seed = root.crypto && root.crypto.getRandomValues ? root.crypto.getRandomValues(new Uint32Array(2)).join('-') : String(Date.now()) + '-' + Math.random();
    run(() => store.setMap(generateTerrain(sceneInput.value, sizeInput.value, seed)));
  });
  doc.getElementById('map-zoom-in').addEventListener('click', () => zoomAt(1.25));
  doc.getElementById('map-zoom-out').addEventListener('click', () => zoomAt(.8));
  doc.getElementById('map-fit').addEventListener('click', fit);
  doc.getElementById('map-center').addEventListener('click', () => {
    if (!currentMap || !selected) return;
    const marker = Array.from(tokens.children).find(node => node.dataset.id === selected);
    if (!marker) return;
    const target = marker.querySelector('.map-token-symbol').getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    offsetX += bounds.left + viewport.clientLeft + viewport.clientWidth / 2 - (target.left + target.width / 2);
    offsetY += bounds.top + viewport.clientTop + viewport.clientHeight / 2 - (target.top + target.height / 2);
    transform();
  });
  viewport.addEventListener('wheel', event => { if (!currentMap) return; event.preventDefault(); const box = viewport.getBoundingClientRect(); const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1); zoomAt(Math.exp(-clamp(pixels, -100, 100) * .0099), event.clientX - box.left, event.clientY - box.top); }, { passive: false });
  function restoreTokenDrag() {
    if (gesture && gesture.type === 'token') {
      gesture.node.style.left = gesture.x + 'px';
      gesture.node.style.top = gesture.y + 'px';
      selected = gesture.previousSelection;
      renderPanel(store.getParticipants());
      tokens.querySelectorAll('.map-token').forEach(node => node.classList.toggle('is-selected', node.dataset.id === selected));
    }
    gesture = null;
  }
  function startTouchGesture() {
    restoreTokenDrag();
    touchLocked = true;
    suppressTouchClick = true;
    const [a, b] = Array.from(touchPoints.entries());
    const box = viewport.getBoundingClientRect();
    const midpointX = (a[1].x + b[1].x) / 2 - box.left - viewport.clientLeft;
    const midpointY = (a[1].y + b[1].y) / 2 - box.top - viewport.clientTop;
    touchGesture = { ids: [a[0], b[0]], distance: Math.max(1, Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y)), zoom, mapX: (midpointX - offsetX) / zoom, mapY: (midpointY - offsetY) / zoom };
  }
  viewport.addEventListener('pointerdown', event => {
    if (!currentMap || event.button !== 0 || event.target.closest('.map-zoom-controls')) return;
    if (event.pointerType === 'touch') {
      if (!touchPoints.size) suppressTouchClick = false;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture(event.pointerId);
      if (touchPoints.size === 2 && !touchLocked) startTouchGesture();
      if (touchPoints.size > 2) { touchLocked = true; suppressTouchClick = true; touchGesture = null; }
      event.preventDefault();
      if (touchLocked || !event.isPrimary) return;
    }
    if (gesture || touchLocked) return;
    const marker = event.target.closest('.map-token');
    if (marker) {
      marker.focus();
      const previousSelection = selected;
      selected = marker.dataset.id; renderPanel(store.getParticipants()); tokens.querySelectorAll('.map-token').forEach(n => n.classList.toggle('is-selected', n.dataset.id === selected));
      const pos = currentMap.positions[selected]; gesture = { type: 'token', id: selected, node: marker, previousSelection, startX: event.clientX, startY: event.clientY, x: pos.x, y: pos.y };
    } else if (event.pointerType !== 'touch') gesture = { type: 'pan', startX: event.clientX, startY: event.clientY, x: offsetX, y: offsetY };
    if (!gesture) return;
    gesture.pointerId = event.pointerId;
    viewport.setPointerCapture(event.pointerId); event.preventDefault();
  });
  viewport.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' && touchPoints.has(event.pointerId)) {
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchGesture && currentMap) {
        const [a, b] = touchGesture.ids.map(id => touchPoints.get(id));
        if (a && b) {
          const box = viewport.getBoundingClientRect();
          const nextZoom = clamp(touchGesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / touchGesture.distance, .1, 3);
          offsetX = (a.x + b.x) / 2 - box.left - viewport.clientLeft - touchGesture.mapX * nextZoom;
          offsetY = (a.y + b.y) / 2 - box.top - viewport.clientTop - touchGesture.mapY * nextZoom;
          zoom = nextZoom;
          transform();
        }
      }
      if (touchLocked) return;
    }
    if (!gesture || event.pointerId !== gesture.pointerId || !currentMap) return;
    if (gesture.type === 'pan') { offsetX = gesture.x + event.clientX - gesture.startX; offsetY = gesture.y + event.clientY - gesture.startY; transform(); }
    else { const x = clamp(Math.round(gesture.x + (event.clientX - gesture.startX) / zoom), 0, currentMap.width - 1), y = clamp(Math.round(gesture.y + (event.clientY - gesture.startY) / zoom), 0, currentMap.height - 1); gesture.node.style.left = clamp(x, 30, currentMap.width - 30) + 'px'; gesture.node.style.top = clamp(y, 30, currentMap.height - 30) + 'px'; gesture.nextX = x; gesture.nextY = y; }
  });
  function finishGesture(event) {
    if (event.pointerType === 'touch' && touchPoints.has(event.pointerId)) {
      touchPoints.delete(event.pointerId);
      if (touchLocked) {
        touchGesture = null;
        if (!touchPoints.size) touchLocked = false;
        return;
      }
    }
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const done = gesture; gesture = null;
    if (event.type !== 'pointerup') { if (done.type === 'token') restoreTokenNode(done); return; }
    if (done.type === 'token' && Number.isFinite(done.nextX)) run(() => store.moveToken(done.id, done.nextX, done.nextY));
  }
  function restoreTokenNode(done) { done.node.style.left = done.x + 'px'; done.node.style.top = done.y + 'px'; }
  viewport.addEventListener('pointerup', finishGesture); viewport.addEventListener('pointercancel', finishGesture); viewport.addEventListener('lostpointercapture', finishGesture);
  viewport.addEventListener('click', event => { if (suppressTouchClick && event.pointerType === 'touch') { event.preventDefault(); event.stopPropagation(); } }, true);
  tokens.addEventListener('click', event => { const marker = event.target.closest('.map-token'); if (!marker) return; selected = marker.dataset.id; renderTokens(currentMap, store.getParticipants()); renderPanel(store.getParticipants()); const next = Array.from(tokens.children).find(n => n.dataset.id === selected); if (next) next.focus(); });
  tokens.addEventListener('keydown', event => { const marker = event.target.closest('.map-token'); if (!marker || !currentMap) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selected = marker.dataset.id; renderTokens(currentMap, store.getParticipants()); renderPanel(store.getParticipants()); const next = Array.from(tokens.children).find(n => n.dataset.id === selected); if (next) next.focus(); return; } const vectors = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }; const d = vectors[event.key]; if (!d) return; event.preventDefault(); selected = marker.dataset.id; const pos = currentMap.positions[selected], step = event.shiftKey ? 20 : 5; run(() => store.moveToken(selected, pos.x + d[0] * step, pos.y + d[1] * step)); const next = Array.from(tokens.children).find(n => n.dataset.id === selected); if (next) next.focus(); });
  if (root.ResizeObserver) new root.ResizeObserver(() => { if (currentMap && section.classList.contains('active') && viewport.clientWidth && viewport.clientHeight && !gesture && !touchPoints.size) fit(); }).observe(viewport);
  doc.addEventListener('one-ring:tab', event => { if (event.detail === 'map' || event.detail && event.detail.tab === 'map') root.requestAnimationFrame(() => { if (currentMap && viewport.clientWidth) fit(); }); });
  store.subscribe(refresh); refresh(store.getState());
  function selectParticipant(id) {
    const participants = store.getParticipants();
    if (!participants.some(person => person.id === id)) return;
    selected = id;
    if (currentMap) renderTokens(currentMap, participants);
    renderPanel(participants);
  }
  root.OneRingMap = { generateTerrain, fit, selectParticipant };
})(typeof window !== 'undefined' ? window : null);
