const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../state.js');

function storage(seed = {}) { const data = { ...seed }; return { getItem: key => key in data ? data[key] : null, setItem: (key, value) => { data[key] = value; }, data }; }
test('migrates legacy enemies without removing legacy data', () => {
  const s = storage({ 'one-ring-battle': JSON.stringify([{ id: 'orc', name: 'Orc', endurance: 4, hate: 2 }]), 'one-ring-library': JSON.stringify([{ id: 'wolf', name: 'Wolf', endurance: 8, hate: 0 }]) });
  const store = createStore(s); const state = store.getState();
  assert.equal(state.version, 2); assert.equal(state.battle[0].maxEndurance, 4); assert.equal(state.library[0].kind, 'Bestia'); assert.ok(s.data['one-ring-battle']);
  store.addLibrary({ name: 'New', endurance: 1, hate: 0 }); assert.ok(s.data['one-ring-state']);
});
test('hero lifecycle exposes a flattened participant and clamps resources', () => {
  const store = createStore(storage()); const hero = store.saveHero({ name: 'Meriadoc', maxEndurance: 10, endurance: 8, maxHope: 5, hope: 2 });
  store.addHero(hero.id); store.addHero(hero.id); const pid = 'hero:' + hero.id;
  store.adjustResource(pid, 'endurance', 99); store.adjustResource(pid, 'hope', -99);
  const participant = store.getParticipants().find(x => x.id === pid);
  assert.equal(store.getState().heroParticipants.length, 1); assert.equal(participant.endurance, 10); assert.equal(participant.hope, 0); assert.equal(participant.type, 'hero');
  store.toggleDefeated(pid); store.saveHero({ id: hero.id, name: 'Merry' });
  assert.equal(store.getState().heroes[0].defeated, true);
  store.deleteHero(hero.id); assert.equal(store.getParticipants().length, 0);
});
test('backup round-trips exactly and invalid restore changes nothing', () => {
  const store = createStore(storage()); const e = store.addEnemy({ name: 'Orc', maxEndurance: 6, maxHate: 2 }); store.setMap({ scene: 'clearing', size: 'small', seed: 'a', width: 900, height: 600, terrain: [], positions: {} }); store.moveToken(e.id, 1, 2);
  const backup = store.exportBackup(); const second = createStore(storage()); second.restoreBackup(backup); assert.deepEqual(second.exportBackup(), backup);
  const before = second.exportBackup(); assert.throws(() => second.restoreBackup({ version: 9 })); assert.deepEqual(second.exportBackup(), before);
});
test('malformed saved state is explicit and recoverable by restoring a valid backup', () => {
  const s = storage({ 'one-ring-state': '{not json' }); const store = createStore(s);
  assert.ok(store.loadError); assert.throws(() => store.addEnemy({ name: 'blocked' }));
  store.restoreBackup({ version: 2, library: [], battle: [], heroes: [], heroParticipants: [], map: null });
  assert.equal(store.loadError, null); assert.equal(store.getState().version, 2);
});
test('map staging is separated, uses margins, and legacy malformed input blocks writes', () => {
  const legacy = storage({ 'one-ring-battle': '{broken', 'one-ring-library': '[]' }); const broken = createStore(legacy);
  assert.ok(broken.loadError); assert.throws(() => broken.addEnemy({ name: 'blocked' })); assert.equal(legacy.data['one-ring-state'], undefined);
  const store = createStore(storage()); const a = store.addEnemy({ name: 'A' }), b = store.addEnemy({ name: 'B' }); const h = store.saveHero({ name: 'H' }); store.addHero(h.id);
  store.setMap({ scene: 'clearing', size: 'small', seed: 42, width: 900, height: 600, terrain: [{ kind: 'tree', x: 12, y: 24, r: 8, rotation: 0, variant: 1 }], positions: {} });
  const p = store.getState().map.positions; assert.equal(p[a.id].x, 836); assert.equal(p['hero:' + h.id].x, 64); assert.notDeepEqual(p[a.id], p[b.id]); assert.equal(store.getState().map.seed, 42);
});
test('backup rejects a battle id that collides with a hero participant', () => {
  const store = createStore(storage()); const backup = { version: 2, library: [], battle: [{ id: 'hero:h', name: 'bad' }], heroes: [{ id: 'h' }], heroParticipants: [{ id: 'hero:h', heroId: 'h' }], map: null };
  assert.throws(() => store.restoreBackup(backup));
});

test('failed storage write rolls back state and observer errors do not roll back persisted data', () => {
  const disk = storage(); const store = createStore(disk);
  disk.setItem = () => { throw new Error('quota'); };
  assert.throws(() => store.addEnemy({name:'Orc',endurance:5}), /quota/);
  assert.equal(store.getParticipants().length,0);
  const durable = storage(); const observed = createStore(durable);
  observed.subscribe(() => { throw new Error('broken observer'); });
  const original = console.error; console.error = () => {};
  try { observed.addEnemy({name:'Orc',endurance:5}); } finally { console.error = original; }
  assert.deepEqual(observed.getState(), createStore(durable).getState());
});
test('staging preserves existing positions and handles a crowded small map', () => {
  const store = createStore(storage());
  const a = store.addEnemy({name:'Orc',endurance:5});
  store.setMap({scene:'clearing',size:'small',seed:1,width:100,height:100,terrain:[],positions:{}});
  store.moveToken(a.id,40,50);
  for(let i=0;i<12;i++) store.addEnemy({name:'Orc',endurance:5});
  assert.deepEqual(store.getState().map.positions[a.id],{x:40,y:50});
  assert.equal(Object.keys(store.getState().map.positions).length,13);
});
