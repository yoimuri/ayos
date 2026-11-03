import assert from 'node:assert/strict';
import { test } from 'node:test';

import { surveyComplete } from '../src/lib/survey/questions.ts';

test('the rider questions are complete with brand, year, visits and one service; the model is optional', () => {
  assert.equal(surveyComplete(undefined), false);
  assert.equal(surveyComplete({}), false);
  assert.equal(surveyComplete({ brand: 'Honda', year: '2024', visits: '2–4', services: [] }), false);
  assert.equal(surveyComplete({ brand: 'Honda', year: '2024', visits: '2–4', services: ['Change oil'] }), true);
  assert.equal(surveyComplete({ brand: 'Honda', year: '2024', services: ['Tires'] }), false);
});
