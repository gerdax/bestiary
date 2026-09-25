# One Ring shared state API

`state.js` exposes a browser singleton as `window.OneRingStore`. In Node, use
`const { createStore } = require('./state.js')`. `createStore(storage)` accepts a
localStorage-compatible object and is useful for tests.

`getState()` and `exportBackup()` return plain, detached objects with version 2:
`{ version, library, battle, heroes, heroParticipants, map }`. `subscribe(fn)`
receives a new snapshot after each mutating operation and returns an unsubscribe
function. The persistent key is `one-ring-state`; legacy battle/library keys are
read once as a migration source and never removed. If an existing state payload
is malformed, `loadError` explains the startup problem and normal mutations are
blocked; call `restoreBackup(validBackup)` to explicitly recover it.

Battle and library methods are `addEnemy`, `removeParticipant`, `clearBattle`,
`toggleDefeated`, `adjustResource`, `reorderEnemies`, `addLibrary`,
`removeLibrary`, and `importLibrary`. Enemy battle entries retain the legacy
fields (`endurance`, `maxEndurance`, `hate`, `maxHate`, `defeated`, and combat
metadata). `importLibrary(data)` accepts an array or `{library}` and returns the
number added.

Heroes are saved with `saveHero(data)` (which returns the saved hero), removed
with `deleteHero(id)`, and put into battle using `addHero(id)`. `getParticipants()`
combines battle enemies and hero participants. Hero participant IDs are
`hero:<heroId>`; records have `type: 'hero'` or `type: 'enemy'`.

`setMap(map)` sets a map and resets token staging. `moveToken(id, x, y)` clamps
map-pixel coordinates to a 32px inset within its bounds. New participants use
separate staging areas, while existing positions remain unchanged. Scenes are
`forest`, `clearing`, `ruins`, `cave`; sizes are `small`, `medium`, `large`. `restoreBackup(data)` validates the entire version-2
backup before replacing state, and throws when it is invalid.
