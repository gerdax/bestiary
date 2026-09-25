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
test('full hero sheet persists through reload, partial save, and version-2 backup', () => {
  const disk = storage();
  const store = createStore(disk);
  const sheet = {
    name: 'Éowyn', age: '24', treasure: '12', calling: 'Kapitan', culturalBlessing: 'Błogosławieństwo',
    distinctiveFeatures: 'Śmiała', flaws: 'Duma', patron: 'Gandalf', shadowPath: 'Ścieżka',
    injury: 'Blizna', rewards: 'Pierścień', virtues: 'Odwaga', equipment: 'Lina',
    standardOfLiving: 'Dostatni', armourName: 'Kolczuga', helmName: 'Hełm', shieldName: 'Tarcza',
    shadowScars: 2, valour: 3, wisdom: 4, adventurePoints: 5, skillPoints: 6,
    fellowship: 7, helmProtection: 1, armourLoad: 3, helmLoad: 2, shieldParry: 1, shieldLoad: 2,
    weary: true, miserable: false, wounded: true,
    weapons: 'legacy weapon', proficiencies: 'legacy proficiency', conditions: 'legacy condition', notes: 'legacy note'
  };
  const skills = ['Awareness', 'Song', 'Hunting', 'Awe', 'Craft', 'Athletics', 'Insight', 'Courtesy', 'Healing', 'Enhearten', 'Battle', 'Travel', 'Scan', 'Riddle', 'Explore', 'Persuade', 'Lore', 'Stealth'];
  skills.forEach((name, index) => {
    sheet['skill' + name] = index % 7;
    sheet['skill' + name + 'Favoured'] = index % 2 === 0;
  });
  Object.assign(sheet, { combatBows: 1, combatSwords: 2, combatAxes: 3, combatSpears: 6 });
  for (let index = 0; index < 4; index++) {
    for (const suffix of ['Name', 'Damage', 'Injury', 'Load', 'Notes']) sheet['weapon' + index + suffix] = suffix + index;
  }
  const saved = store.saveHero(sheet);
  const reloaded = createStore(disk).getState().heroes[0];
  for (const [field, value] of Object.entries(sheet)) assert.equal(reloaded[field], value, field);
  assert.equal(reloaded.id, saved.id);
  const partial = createStore(disk);
  partial.saveHero({ id: saved.id, name: 'Dernhelm', skillAwareness: 6, wounded: false });
  const updated = partial.getState().heroes[0];
  assert.equal(updated.name, 'Dernhelm'); assert.equal(updated.skillAwareness, 6); assert.equal(updated.wounded, false);
  assert.equal(updated.skillSong, sheet.skillSong); assert.equal(updated.weapon3Notes, sheet.weapon3Notes);
  assert.equal(updated.weapons, sheet.weapons); assert.equal(updated.notes, sheet.notes);
  const backup = partial.exportBackup();
  const restored = createStore(storage()); restored.restoreBackup(backup);
  assert.deepEqual(restored.exportBackup(), backup);
});
test('old version-2 heroes gain sheet defaults without losing legacy fields', () => {
  const old = { version: 2, library: [], battle: [], heroes: [{ id: 'hero-old', name: 'Bilbo', weapons: 'Sting', proficiencies: 'Sword', conditions: 'Tired', notes: 'Old note', maxHope: 5, hope: 3 }], heroParticipants: [], map: null };
  const store = createStore(storage({ 'one-ring-state': JSON.stringify(old) }));
  const hero = store.getState().heroes[0];
  assert.equal(store.loadError, null);
  assert.equal(hero.weapons, 'Sting'); assert.equal(hero.proficiencies, 'Sword');
  assert.equal(hero.conditions, 'Tired'); assert.equal(hero.notes, 'Old note'); assert.equal(hero.hope, 3);
  assert.equal(hero.age, ''); assert.equal(hero.weapon0Name, ''); assert.equal(hero.valour, 0);
  assert.equal(hero.skillAwareness, 0); assert.equal(hero.skillAwarenessFavoured, false);
  assert.equal(hero.combatBows, 0); assert.equal(hero.weary, false);
  const imported = createStore(storage()); imported.restoreBackup(old);
  assert.deepEqual(imported.getState().heroes[0], hero);
});
test('skill and combat ratings are integer values from zero to six', () => {
  const store = createStore(storage());
  const hero = store.saveHero({ name: 'Sam', skillAwareness: 9.8, skillSong: -2, skillHunting: '3.9', skillAwe: 'invalid', combatBows: 8, combatSwords: -1, combatAxes: 2.9, combatSpears: 'bad' });
  assert.equal(hero.skillAwareness, 6); assert.equal(hero.skillSong, 0);
  assert.equal(hero.skillHunting, 3); assert.equal(hero.skillAwe, 0);
  assert.equal(hero.combatBows, 6); assert.equal(hero.combatSwords, 0);
  assert.equal(hero.combatAxes, 2); assert.equal(hero.combatSpears, 0);
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

test('clearEncounter atomically removes map and participants but retains sheets and library', () => {
  const disk = storage(); const store = createStore(disk);
  const h = store.saveHero({ name: 'Frodo', maxHope: 10, hope: 7, wounded: true });
  store.addHero(h.id); store.addEnemy({ name: 'Ork' }); store.addLibrary({ name: 'Wilk' });
  store.setMap({ scene: 'clearing', size: 'small', seed: 'clear', width: 900, height: 900, terrain: [], positions: {} });
  const before = store.exportBackup(); const events = [];
  store.subscribe(snapshot => events.push(snapshot));
  const originalWrite = disk.setItem;
  disk.setItem = () => { throw new Error('quota'); };
  assert.throws(() => store.clearEncounter());
  assert.deepEqual(store.exportBackup(), before);
  assert.equal(events.length, 0);
  disk.setItem = originalWrite;
  store.clearEncounter();
  const after = store.exportBackup();
  assert.deepEqual(after.heroes, before.heroes); assert.deepEqual(after.library, before.library);
  assert.deepEqual(after.battle, []); assert.deepEqual(after.heroParticipants, []); assert.equal(after.map, null);
  assert.equal(events.length, 1); assert.deepEqual(events[0], after);
  assert.deepEqual(createStore(disk).exportBackup(), after);
});
