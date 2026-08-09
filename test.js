// node test.js — checks number normalization and the Skopje timestamp. No SMS is sent.
import assert from 'node:assert/strict';
import { normalize, skopjeStamp } from './api/send.js';

const accepted = [
  '+389 75 560 524',
  '+38975560524',
  '0038975560524',
  '38975560524',
  '075 560 524',
  '075-560-524',
  '75560524',
];
for (const input of accepted) {
  assert.equal(normalize(input), '+38975560524', `expected ${input} to normalize`);
}

const rejected = ['', null, '123', '+38915560524', '+3897556052', '+389755605245', '+441234567890'];
for (const input of rejected) {
  assert.equal(normalize(input), null, `expected ${JSON.stringify(input)} to be rejected`);
}

// Skopje is CET (UTC+1) in winter and CEST (UTC+2) in summer.
assert.equal(skopjeStamp(new Date('2026-01-15T10:22:00Z')), '15.01.2026 11:22');
assert.equal(skopjeStamp(new Date('2026-07-05T15:22:00Z')), '05.07.2026 17:22');
assert.match(skopjeStamp(), /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);

console.log('all checks passed');
console.log(`Kupivte bilet za edno vozenje so cena od 40 denari na ${skopjeStamp()}`);
