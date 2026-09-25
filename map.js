/* Procedural encounter map. Terrain is stored as small JSON records in map pixels. */
(function (root) {
  'use strict';
  const SIZES = { small: [900, 600], medium: [1200, 800], large: [1600, 1000] };
  const SCENES = { forest: 'Las', clearing: 'Polana', ruins: 'Ruiny', cave: 'Jaskinia' };
  const SVG = 'http://www.w3.org/2000/svg';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function randomFor(seed) {
    let h = 2166136261;
    for (const char of String(seed)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function generateTerrain(scene = 'clearing', size = 'medium', seed = '1') {
    scene = SCENES[scene] ? scene : 'clearing';
    size = SIZES[size] ? size : 'medium';
    const [width, height] = SIZES[size], rng = randomFor(seed), terrain = [];
    const rand = (a, b) => Math.round(a + rng() * (b - a));
    const add = (kind, x, y, r, rotation = 0, variant = 0) => terrain.push({ kind, x: Math.round(x), y: Math.round(y), r: Math.round(r), rotation: Math.round(rotation), variant: Math.round(variant) });
    const count = Math.round(width * height / 10500);
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
  const el = (tag, className, textValue) => { const node = doc.createElement(tag); if (className) node.className = className; if (textValue != null) node.textContent = textValue; return node; };
  const svg = (tag, attrs, parent) => { const node = doc.createElementNS(SVG, tag); Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value))); if (parent) parent.appendChild(node); return node; };
  section.innerHTML = '<div class="section-heading"><div><p class="eyebrow">STÓŁ WĘDROWCÓW</p><h2>Mapa starcia</h2></div><p class="map-heading-note">Przeciągnij znaczniki, aby rozstawić uczestników.</p></div><div class="map-toolbar paper"><label>Sceneria<select id="map-scene"><option value="clearing">Polana</option><option value="forest">Las</option><option value="ruins">Ruiny</option><option value="cave">Jaskinia</option></select></label><label>Rozmiar<select id="map-size"><option value="small">Mały</option><option value="medium" selected>Średni</option><option value="large">Duży</option></select></label><button class="primary" id="map-generate" type="button">Utwórz mapę</button><div class="map-zoom-controls" aria-label="Powiększenie mapy"><button type="button" id="map-zoom-out" aria-label="Pomniejsz mapę">−</button><output id="map-zoom-level">100%</output><button type="button" id="map-zoom-in" aria-label="Powiększ mapę">+</button><button type="button" id="map-fit">Dopasuj</button></div></div><p class="map-error" id="map-error" role="alert" hidden></p><div class="map-layout"><div class="map-viewport" id="map-viewport" aria-label="Mapa starcia"><div class="map-stage" id="map-stage"><svg id="map-terrain" aria-hidden="true"></svg><div id="map-tokens"></div></div><div class="map-blank" id="map-blank"><span>✦</span><strong>Przygotuj pole starcia</strong><p>Wybierz scenerię i rozmiar, aby utworzyć mapę.</p></div></div><aside class="map-panel paper" id="map-panel" aria-live="polite"></aside></div><p class="map-hint">Przesuń tło, aby wędrować po mapie. Kółko myszy i przyciski zmieniają skalę. Strzałki przesuwają wybrany znacznik.</p>';
  const sceneInput = doc.getElementById('map-scene'), sizeInput = doc.getElementById('map-size');
  const generateButton = doc.getElementById('map-generate'), viewport = doc.getElementById('map-viewport'), stage = doc.getElementById('map-stage');
  const terrainSvg = doc.getElementById('map-terrain'), tokens = doc.getElementById('map-tokens'), panel = doc.getElementById('map-panel'), blank = doc.getElementById('map-blank'), zoomOutput = doc.getElementById('map-zoom-level'), errorBox = doc.getElementById('map-error');
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
    svg('rect', { width: map.width, height: map.height, fill: { forest: '#a2aa80', clearing: '#b9bd91', ruins: '#afa997', cave: '#777a71' }[scene] }, terrainSvg);
    const rng = randomFor(map.seed + '-ground');
    for (let i = 0; i < Math.round(map.width * map.height / 4500); i++) {
      svg('ellipse', { cx: Math.round(rng() * map.width), cy: Math.round(rng() * map.height), rx: Math.round(12 + rng() * 55), ry: Math.round(5 + rng() * 22), fill: scene === 'cave' ? '#8e8e7c' : '#ddd1a2', opacity: scene === 'ruins' ? .12 : .16, transform: `rotate(${Math.round(rng() * 180)} ${Math.round(rng() * map.width)} ${Math.round(rng() * map.height)})` }, terrainSvg);
    }
    map.terrain.forEach(record => shape(record, terrainSvg));
    svg('rect', { x: 3, y: 3, width: map.width - 6, height: map.height - 6, fill: 'none', stroke: '#4f493a', 'stroke-width': 6, opacity: .55 }, terrainSvg);
  }
  function displayNames(participants) {
    const counts = {}, used = {};
    participants.filter(p => p.type === 'enemy').forEach(p => { const name = String(p.name || p.kind || 'Przeciwnik'); counts[name] = (counts[name] || 0) + 1; });
    return participants.map(p => { const name = String(p.name || p.kind || (p.type === 'hero' ? 'Bohater' : 'Przeciwnik')); if (p.type === 'enemy' && counts[name] > 1) { used[name] = (used[name] || 0) + 1; return name + ' ' + used[name]; } return name; });
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
    const box = el('div', 'map-resource'); box.appendChild(el('span', '', title));
    const controls = el('div', 'map-resource-controls'), minus = el('button', '', '−'), number = el('strong', '', `${value ?? 0} / ${max ?? 0}`), plus = el('button', '', '+');
    minus.type = plus.type = 'button'; minus.setAttribute('aria-label', `Zmniejsz ${title.toLowerCase()}`); plus.setAttribute('aria-label', `Zwiększ ${title.toLowerCase()}`);
    minus.addEventListener('click', () => run(() => store.adjustResource(id, field, -1))); plus.addEventListener('click', () => run(() => store.adjustResource(id, field, 1)));
    controls.append(minus, number, plus); box.appendChild(controls); container.appendChild(box);
  }
  function renderPanel(participants) {
    panel.replaceChildren();
    if (store.loadError) { panel.append(el('p', 'eyebrow', 'BŁĄD ZAPISU'), el('h3', '', 'Nie można wczytać danych'), el('p', 'map-panel-help', 'Przywróć poprawną kopię zapasową, aby ponownie korzystać z mapy.')); return; }
    if (!currentMap) { panel.append(el('p', 'eyebrow', 'UCZESTNICY'), el('h3', '', 'Mapa czeka na scenerię'), el('p', 'map-panel-help', 'Utwórz mapę, a uczestnicy starcia pojawią się na niej automatycznie.')); return; }
    if (!participants.length) { panel.append(el('p', 'eyebrow', 'UCZESTNICY'), el('h3', '', 'Pusta mapa'), el('p', 'map-panel-help', 'Dodaj bohatera lub przeciwnika do aktywnej walki.')); return; }
    const names = displayNames(participants), index = participants.findIndex(p => p.id === selected), person = participants[index];
    if (!person) { panel.append(el('p', 'eyebrow', 'UCZESTNICY'), el('h3', '', 'Wybierz znacznik'), el('p', 'map-panel-help', 'Dotknij znacznika na mapie, aby zobaczyć zasoby i działania.')); return; }
    panel.append(el('p', 'eyebrow', person.type === 'hero' ? 'BOHATER' : 'PRZECIWNIK'), el('h3', '', names[index]));
    const resources = el('div', 'map-resources'); addAdjuster(resources, person.id, 'endurance', person.endurance, person.maxEndurance, 'Wytrzymałość');
    if (person.type === 'hero') addAdjuster(resources, person.id, 'hope', person.hope, person.maxHope, 'Nadzieja');
    else addAdjuster(resources, person.id, 'hate', person.hate, person.maxHate, person.kind === 'Człowiek' ? 'Determinacja' : 'Nienawiść');
    panel.appendChild(resources);
    const facts = el('div', 'map-panel-facts');
    for (const [label, value] of [['Obrona', person.parry], ['Pancerz', person.armour]]) { const fact = el('div'); fact.append(el('span', '', label), el('strong', '', value ?? '—')); facts.appendChild(fact); }
    panel.appendChild(facts);
    const detail = (label, value) => { if (value == null || value === '') return; const item = el('p', 'map-panel-detail'); item.append(el('b', '', label + ': '), doc.createTextNode(String(value))); panel.appendChild(item); };
    if (person.type === 'hero') { detail('Postawa', person.stance); detail('Broń', person.weapons); detail('Biegłości', person.proficiencies); detail('Stany', person.conditions); }
    else { detail('Atak', person.attack); detail('Atrybuty', person.traits); }
    if (person.type === 'enemy') { const defeated = el('button', 'map-panel-action', person.defeated ? 'Przywróć do walki' : 'Oznacz jako pokonanego'); defeated.type = 'button'; defeated.addEventListener('click', () => run(() => store.toggleDefeated(person.id))); panel.appendChild(defeated); }
    const remove = el('button', 'map-panel-remove', 'Usuń ze starcia'); remove.type = 'button'; remove.addEventListener('click', () => { if (root.confirm(`Usunąć ${names[index]} ze starcia?`)) run(() => store.removeParticipant(person.id)); }); panel.appendChild(remove);
  }
  function transform() { stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`; zoomOutput.value = Math.round(zoom * 100) + '%'; zoomOutput.textContent = zoomOutput.value; }
  function fit() { if (!currentMap || !viewport.clientWidth || !viewport.clientHeight) return; zoom = clamp(Math.min((viewport.clientWidth - 24) / currentMap.width, (viewport.clientHeight - 24) / currentMap.height), .1, 2.5); offsetX = (viewport.clientWidth - currentMap.width * zoom) / 2; offsetY = (viewport.clientHeight - currentMap.height * zoom) / 2; transform(); }
  function zoomAt(factor, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) { if (!currentMap) return; const next = clamp(zoom * factor, .1, 3); offsetX = x - (x - offsetX) * next / zoom; offsetY = y - (y - offsetY) * next / zoom; zoom = next; transform(); }
  function refresh(snapshot) {
    const map = snapshot.map, participants = store.getParticipants();
    const key = map ? JSON.stringify([map.seed, map.scene, map.size, map.width, map.height, map.terrain]) : '';
    const terrainChanged = key !== fittedKey;
    currentMap = map;
    blank.hidden = !!map; stage.hidden = !map;
    generateButton.textContent = map ? 'Wygeneruj ponownie' : 'Utwórz mapę'; generateButton.disabled = !!store.loadError;
    if (store.loadError) { errorBox.textContent = 'Nie można zapisać mapy: zapisane dane są uszkodzone. Przywróć poprawną kopię zapasową.'; errorBox.hidden = false; } else { errorBox.hidden = true; }
    if (map) {
      if (terrainChanged) { sceneInput.value = SCENES[map.scene] ? map.scene : 'clearing'; sizeInput.value = SIZES[map.size] ? map.size : 'medium'; }
      stage.style.width = map.width + 'px'; stage.style.height = map.height + 'px';
      if (terrainChanged) { paintTerrain(map); fittedKey = key; root.requestAnimationFrame(fit); }
      if (selected && !participants.some(p => p.id === selected)) selected = null;
      renderTokens(map, participants);
    } else { fittedKey = ''; selected = null; tokens.replaceChildren(); }
    renderPanel(participants);
  }
  generateButton.addEventListener('click', () => {
    if (currentMap && !root.confirm('Wygenerować nową mapę? Rozstawienie znaczników zostanie wyzerowane.')) return;
    const seed = root.crypto && root.crypto.getRandomValues ? root.crypto.getRandomValues(new Uint32Array(2)).join('-') : String(Date.now()) + '-' + Math.random();
    run(() => store.setMap(generateTerrain(sceneInput.value, sizeInput.value, seed)));
  });
  doc.getElementById('map-zoom-in').addEventListener('click', () => zoomAt(1.25));
  doc.getElementById('map-zoom-out').addEventListener('click', () => zoomAt(.8));
  doc.getElementById('map-fit').addEventListener('click', fit);
  viewport.addEventListener('wheel', event => { if (!currentMap) return; event.preventDefault(); const box = viewport.getBoundingClientRect(); zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - box.left, event.clientY - box.top); }, { passive: false });
  viewport.addEventListener('pointerdown', event => {
    if (!currentMap || gesture || event.button !== 0) return;
    const marker = event.target.closest('.map-token');
    if (marker) {
      marker.focus();
      selected = marker.dataset.id; renderPanel(store.getParticipants()); tokens.querySelectorAll('.map-token').forEach(n => n.classList.toggle('is-selected', n.dataset.id === selected));
      const pos = currentMap.positions[selected]; gesture = { type: 'token', id: selected, node: marker, startX: event.clientX, startY: event.clientY, x: pos.x, y: pos.y };
    } else gesture = { type: 'pan', startX: event.clientX, startY: event.clientY, x: offsetX, y: offsetY };
    gesture.pointerId = event.pointerId;
    viewport.setPointerCapture(event.pointerId); event.preventDefault();
  });
  viewport.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId || !currentMap) return;
    if (gesture.type === 'pan') { offsetX = gesture.x + event.clientX - gesture.startX; offsetY = gesture.y + event.clientY - gesture.startY; transform(); }
    else { const x = clamp(Math.round(gesture.x + (event.clientX - gesture.startX) / zoom), 0, currentMap.width - 1), y = clamp(Math.round(gesture.y + (event.clientY - gesture.startY) / zoom), 0, currentMap.height - 1); gesture.node.style.left = clamp(x, 30, currentMap.width - 30) + 'px'; gesture.node.style.top = clamp(y, 30, currentMap.height - 30) + 'px'; gesture.nextX = x; gesture.nextY = y; }
  });
  function finishGesture(event) { if (!gesture || event.pointerId !== gesture.pointerId) return; const done = gesture; gesture = null; if (event.type === 'pointercancel') { if (currentMap) renderTokens(currentMap, store.getParticipants()); return; } if (done.type === 'token' && Number.isFinite(done.nextX)) run(() => store.moveToken(done.id, done.nextX, done.nextY)); }
  viewport.addEventListener('pointerup', finishGesture); viewport.addEventListener('pointercancel', finishGesture);
  tokens.addEventListener('click', event => { const marker = event.target.closest('.map-token'); if (!marker) return; selected = marker.dataset.id; renderTokens(currentMap, store.getParticipants()); renderPanel(store.getParticipants()); const next = Array.from(tokens.children).find(n => n.dataset.id === selected); if (next) next.focus(); });
  tokens.addEventListener('keydown', event => { const marker = event.target.closest('.map-token'); if (!marker || !currentMap) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selected = marker.dataset.id; renderTokens(currentMap, store.getParticipants()); renderPanel(store.getParticipants()); const next = Array.from(tokens.children).find(n => n.dataset.id === selected); if (next) next.focus(); return; } const vectors = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }; const d = vectors[event.key]; if (!d) return; event.preventDefault(); selected = marker.dataset.id; const pos = currentMap.positions[selected], step = event.shiftKey ? 20 : 5; run(() => store.moveToken(selected, pos.x + d[0] * step, pos.y + d[1] * step)); const next = Array.from(tokens.children).find(n => n.dataset.id === selected); if (next) next.focus(); });
  if (root.ResizeObserver) new root.ResizeObserver(() => { if (currentMap && section.classList.contains('active') && viewport.clientWidth && viewport.clientHeight && !gesture) fit(); }).observe(viewport);
  doc.addEventListener('one-ring:tab', event => { if (event.detail === 'map' || event.detail && event.detail.tab === 'map') root.requestAnimationFrame(() => { if (currentMap && viewport.clientWidth) fit(); }); });
  store.subscribe(refresh); refresh(store.getState());
  root.OneRingMap = { generateTerrain, fit };
})(typeof window !== 'undefined' ? window : null);
