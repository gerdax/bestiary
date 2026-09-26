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
`clearEncounter`, `toggleDefeated`, `adjustResource`, `reorderEnemies`, `addLibrary`,
`removeLibrary`, and `importLibrary`. Enemy battle entries retain the legacy
fields (`endurance`, `maxEndurance`, `hate`, `maxHate`, `defeated`, and combat
metadata). `importLibrary(data)` accepts an array or `{library}` and returns the
number added.

Heroes are saved with `saveHero(data)` (which returns the saved hero), removed
with `deleteHero(id)`, and put into battle using `addHero(id)`. `getParticipants()`
combines battle enemies and hero participants. Hero participant IDs are
`hero:<heroId>`; records have `type: 'hero'` or `type: 'enemy'`.

`saveHero` accepts a partial update when `id` names an existing hero. Omitted
fields retain their values. Hero records retain the original `weapons`,
`proficiencies`, `conditions`, and `notes` text fields alongside the full sheet.
The added string fields are `age`, `treasure`, `calling`, `culturalBlessing`,
`distinctiveFeatures`, `flaws`, `patron`, `shadowPath`, `injury`, `rewards`,
`virtues`, `equipment`, `standardOfLiving`, `armourName`, `helmName`, and
`shieldName`. Added nonnegative numeric fields are `shadowScars`, `valour`,
`wisdom`, `adventurePoints`, `skillPoints`, `fellowship`, `helmProtection`,
`armourLoad`, `helmLoad`, `shieldParry`, and `shieldLoad`. `weary`, `miserable`,
and `wounded` are booleans.

The skill fields are `skillAwareness`, `skillSong`, `skillHunting`, `skillAwe`,
`skillCraft`, `skillAthletics`, `skillInsight`, `skillCourtesy`, `skillHealing`,
`skillEnhearten`, `skillBattle`, `skillTravel`, `skillScan`, `skillRiddle`,
`skillExplore`, `skillPersuade`, `skillLore`, and `skillStealth`. Each has a
matching boolean field ending in `Favoured`, such as `skillAwarenessFavoured`.
Combat ratings are `combatBows`, `combatSwords`, `combatAxes`, and
`combatSpears`. Skills and combat ratings are integer values clamped to 0–6.
Four weapon rows use flat string fields `weapon0Name`, `weapon0Damage`,
`weapon0Injury`, `weapon0Load`, `weapon0Notes`, continuing through `weapon3Notes`.
Missing sheet fields in old version-2 records and backups default to empty
strings, zero, or false; the backup version remains 2.

`setMap(map)` sets a map and resets token staging. `moveToken(id, x, y)` clamps
map-pixel coordinates to a 32px inset within its bounds. New participants use
separate staging areas, while existing positions remain unchanged. Scenes are
`forest`, `clearing`, `ruins`, `cave`; sizes are `small`, `medium`, `large`. `restoreBackup(data)` validates the entire version-2
backup before replacing state, and throws when it is invalid.

New small, medium and large maps are square: 900, 1200 and 1600 pixels per side.
Existing maps retain their dimensions until regenerated.

`clearEncounter()` atomically removes battle enemies, hero participants and the map,
while retaining hero sheets and the enemy library. `clearBattle()` retains its
original contract (participants only).

Hero `shadow` is clamped to at least `shadowScars` during normalization, including
save, load and backup restore. Raising scars raises shadow when necessary; lowering
scars does not lower the existing shadow value. The backup version remains 2.

Enemy forms always create a new record with `source` and `category` set to
`Własne`. Library category filters exclude own records, including older records
that retained a template category. Optional enemy `distinctiveFeatures` contains
free-text distinguishing features, preserved through copies and backups; missing
values display as empty. `kind` is free text and is displayed with the source.

Enemy `resourceType` is `hate` or `determination`, independent of free-text `kind`.
Old records default to determination for `Człowiek`, otherwise hate. The numeric
resource remains in `hate`/`maxHate`; the backup version remains 2.
