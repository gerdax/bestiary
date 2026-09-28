const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../dice-rules.js');

const setup = (changes = {}) => ({ actor: 'hero', baseDice: 3, bonus: 0,
  hope: false, inspired: false, featMode: 'normal', exhausted: false,
  miserable: false, target: '', ...changes });

test('pool uses Hope and Inspiration once and clamps to physical bounds', () => {
  assert.equal(rules.calculatePool(setup({ baseDice: 0, bonus: -6 })), 0);
  assert.equal(rules.calculatePool(setup({ baseDice: 6, bonus: 6, hope: true, inspired: true })), 14);
  assert.equal(rules.calculatePool(setup({ baseDice: 3, hope: true, inspired: true })), 5);
  assert.equal(rules.calculatePool(setup({ actor: 'enemy', hope: true, inspired: true })), 3);
});

test('favoured hero chooses Gandalf over ten and succeeds automatically', () => {
  const result = rules.interpretRoll(setup({ baseDice: 0, featMode: 'favoured', target: 99 }), { feat: [10, 12], success: [] });
  assert.equal(result.selectedFeatIndex, 1);
  assert.equal(result.sum, 0);
  assert.equal(result.passed, true);
});

test('weary selects lower die and miserable selected Eye fails even at PT zero', () => {
  const result = rules.interpretRoll(setup({ baseDice: 0, featMode: 'weary', miserable: true, target: 0 }), { feat: [12, 11], success: [] });
  assert.equal(result.selectedFeat, 11);
  assert.equal(result.automaticFailure, true);
  assert.equal(result.passed, false);
});

test('enemy reverses symbols and ignores miserable and Hope', () => {
  const result = rules.interpretRoll(setup({ actor: 'enemy', baseDice: 0, featMode: 'favoured', miserable: true, hope: true, target: 99 }), { feat: [10, 11], success: [] });
  assert.equal(result.selectedFeat, 11);
  assert.equal(result.automaticSuccess, true);
  assert.equal(result.sum, 0);
  assert.equal(result.passed, true);
  const zero = rules.interpretRoll(setup({ actor: 'enemy', baseDice: 0, target: 1 }), { feat: [12], success: [] });
  assert.equal(zero.sum, 0);
  assert.equal(zero.passed, false);
});

test('exhaustion changes 1–3 values but keeps raw faces and success marks', () => {
  const result = rules.interpretRoll(setup({ baseDice: 4, exhausted: true, target: 15 }), { feat: [7], success: [1, 3, 5, 6] });
  assert.deepEqual(result.successDice.map(die => die.value), [0, 0, 5, 6]);
  assert.deepEqual(result.successDice.map(die => die.raw), [1, 3, 5, 6]);
  assert.equal(result.sum, 18);
  assert.equal(result.marks, 1);
  assert.equal(result.passed, true);
});

test('Gandalf adds no numeric value to the total while preserving automatic success', () => {
  const result = rules.interpretRoll(setup({ baseDice: 5, exhausted: true, target: 99 }),
    { feat: [12], success: [6, 5, 3, 2, 4] });
  assert.equal(result.sum, 15);
  assert.equal(result.marks, 1);
  assert.equal(result.passed, true);
});

test('without PT no success or failure verdict is returned', () => {
  const result = rules.interpretRoll(setup({ baseDice: 0 }), { feat: [12], success: [] });
  assert.equal(result.target, null);
  assert.equal(result.passed, null);
});

test('rejects engine output that differs from requested physical dice', () => {
  assert.throws(() => rules.interpretRoll(setup({ baseDice: 1 }), { feat: [3], success: [] }), TypeError);
  assert.throws(() => rules.interpretRoll(setup({ baseDice: 0 }), { feat: [13], success: [] }), TypeError);
  assert.throws(() => rules.interpretRoll(setup({ baseDice: 0, target: -1 }), { feat: [3], success: [] }), TypeError);
});
