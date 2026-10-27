import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EMPTY_FIELDWORK,
  addShop,
  locationText,
  moveNewShop,
  parseLocation,
  changeRows,
  closedText,
  currentValues,
  deleteEntry,
  editEntry,
  needsExportReminder,
  editedShopRows,
  newShopRows,
  parseBackup,
  parseClosed,
  parsePhones,
  parseTime,
  recordEdit,
  restoreField,
  restoreShop,
  timeText,
  toBackup,
  type FieldEdit,
} from '../src/lib/fieldwork/model.ts';
import { writeXlsx } from '../src/lib/fieldwork/xlsx.ts';
import { isComplete, overall, parsePersonal, toggleId } from '../src/lib/personal/model.ts';
import { strFromU8, unzipSync } from 'fflate';

const edit = (id: string, field: FieldEdit['field'], before: string, after: string, at = 1000): FieldEdit => ({
  id, shopId: 's1', field, before, after, at,
});

test('the original is never overwritten: current values are the newest edits', () => {
  let d = recordEdit(EMPTY_FIELDWORK, edit('e1', 'contact', '', '0917 111 2222'));
  d = recordEdit(d, edit('e2', 'contact', '0917 111 2222', '0917 333 4444', 2000));
  assert.deepEqual(currentValues(d, 's1'), { contact: '0917 333 4444' });
  assert.equal(d.log.length, 2, 'both edits kept as history');
});

test('typing back the same value records nothing', () => {
  const d = recordEdit(EMPTY_FIELDWORK, edit('e1', 'name', 'Shop A', 'Shop A'));
  assert.equal(d.log.length, 0);
});

test('a wrong entry can be corrected or deleted, and restore goes back to the original', () => {
  let d = recordEdit(EMPTY_FIELDWORK, edit('e1', 'contact', '', '0917 111 2222'));
  d = recordEdit(d, edit('e2', 'time', '', '9:00 - 18:00'));
  d = editEntry(d, 'e1', '0917 111 9999');
  assert.equal(currentValues(d, 's1').contact, '0917 111 9999');
  d = deleteEntry(d, 'e2');
  assert.equal(currentValues(d, 's1').time, undefined);
  d = restoreField(d, 's1', 'contact');
  assert.deepEqual(currentValues(d, 's1'), {});
  d = recordEdit(d, edit('e3', 'name', 'A', 'B'));
  assert.deepEqual(currentValues(restoreShop(d, 's1'), 's1'), {});
});

test('the Changes tab lists every edit with what it was before', () => {
  const d = recordEdit(EMPTY_FIELDWORK, edit('e1', 'contact', '', '0917 111 2222', new Date(2026, 9, 11, 14, 5).getTime()));
  const t = changeRows(d, () => 'Brothers Moto');
  assert.deepEqual(t.header, ['Date', 'Shop ID', 'Shop name', 'Column', 'Before', 'After']);
  assert.deepEqual(t.rows, [['2026-10-11 14:05', 's1', 'Brothers Moto', 'Contact No.', '', '0917 111 2222']]);
});

test('new shops come out in the field sheet column order, coordinates as numbers', () => {
  const d = addShop(EMPTY_FIELDWORK, { id: 'n1', lat: 14.6702, lng: 121.0678, accuracy: 8, createdAt: 1, values: { name: 'New Shop', contact: '0917 000 1111' } });
  const t = newShopRows(d);
  assert.deepEqual(t.header.slice(0, 6), ['Name', 'Address', 'Latitude', 'Longitude', 'Services', 'Contact No.']);
  assert.deepEqual(t.rows[0].slice(0, 6), ['New Shop', '', 14.6702, 121.0678, '', '0917 000 1111']);
  assert.equal(t.marks[0][0], 'added');
});

test('an edited shop is one complete row: new values in, changed cells marked, first before to last after', () => {
  const original = { name: 'Moto A', address: 'Pasig', tags: ['repair'], phones: [], links: [], lat: 14.5, lng: 121.05 };
  let d = recordEdit(EMPTY_FIELDWORK, edit('e1', 'contact', '', '0917 111 2222', 1000));
  d = recordEdit(d, edit('e2', 'contact', '0917 111 2222', '0917 333 4444', 2000));
  d = recordEdit(d, edit('e3', 'location', '14.5000000, 121.0500000', '14.5001000, 121.0502000', 3000));
  const t = editedShopRows(d, () => original);
  const row = t.rows[0];
  assert.equal(row[0], 's1');
  assert.equal(row[1], 'Moto A', 'unchanged columns keep the original');
  assert.deepEqual([row[3], row[4]], [14.5001, 121.0502]);
  assert.equal(row[6], '0917 333 4444');
  assert.deepEqual([t.marks[0][1], t.marks[0][3], t.marks[0][6]], [null, 'changed', 'changed']);
  assert.equal(row[12], 'Contact No.: (blank) -> 0917 333 4444; Latitude, Longitude: 14.5000000, 121.0500000 -> 14.5001000, 121.0502000');
});

test('the .xlsx is a zip with one sheet per tab, text escaped, numbers as numbers, marks styled', () => {
  const bytes = writeXlsx([
    { name: 'New shops', header: ['Name', 'Latitude'], rows: [['Tom & Jerry <Moto>', 14.5]], marks: [['added', null]] },
    { name: 'Changes', header: ['Column'], rows: [], marks: [] },
  ]);
  const files = unzipSync(bytes);
  assert.ok(files['xl/workbook.xml'] && files['xl/styles.xml'] && files['xl/worksheets/sheet2.xml']);
  assert.match(strFromU8(files['xl/workbook.xml']), /<sheet name="New shops"[^>]*\/><sheet name="Changes"/);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  assert.match(sheet, /<c r="A2" s="3" t="inlineStr"><is><t xml:space="preserve">Tom &amp; Jerry &lt;Moto&gt;<\/t>/);
  assert.match(sheet, /<c r="B2"><v>14.5<\/v><\/c>/);
});

test('a backup restores exactly, and a wrong file is refused instead of wiping the survey', () => {
  let d = recordEdit(EMPTY_FIELDWORK, edit('e1', 'note', '', 'closed on holidays'));
  d = addShop(d, { id: 'n1', lat: 14.6, lng: 121, accuracy: null, createdAt: 5, values: { name: 'X' } });
  assert.deepEqual(parseBackup(toBackup(d, 99)), d);
  assert.equal(parseBackup('{"hello":1}'), null);
  assert.equal(parseBackup('not json'), null);
});

test('export reminder after a day of unexported work, not before', () => {
  const d = recordEdit(EMPTY_FIELDWORK, edit('e1', 'note', '', 'x', 1000));
  assert.equal(needsExportReminder(d, 1000 + 60_000), false);
  assert.equal(needsExportReminder(d, 1000 + 25 * 3600_000), true);
  assert.equal(needsExportReminder({ ...d, lastExportAt: 2000 }, 2000 + 25 * 3600_000), false, 'nothing new since export');
});

test('sheet text turns into app data with the import script rules', () => {
  assert.deepEqual(parsePhones('0915 9777778, (02) 8537-6900 loc. 12, 0919 740 283'), ['0915-977-7778', '(02) 8537-6900']);
  assert.deepEqual(parseTime('9:00 - 20:00'), { open: '09:00', close: '20:00' });
  assert.equal(parseTime('morning'), null);
  assert.deepEqual(parseClosed('Saturday and Sunday'), [0, 6]);
  assert.deepEqual(parseClosed('Everyday Open'), []);
  assert.equal(parseClosed('sometimes'), null);
  assert.equal(timeText({ open: '09:00', close: '20:00' }), '9:00 - 20:00');
  assert.equal(closedText([0, 6]), 'Sunday and Saturday');
});

test('my shops: toggles never duplicate, one overall score from three parts', () => {
  assert.deepEqual(toggleId(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']);
  assert.equal(overall({ service: 5, price: 4, assistance: 4 }), 4.3);
  assert.equal(isComplete({ service: 5, price: 4 }), false);
  assert.deepEqual(parsePersonal('broken{'), { saved: [], visited: [], ratings: {} });
});

test('map pin: coordinates as the sheet writes them, a moved pin drops its GPS accuracy', () => {
  assert.equal(locationText(14.65312, 121.03456), '14.6531200, 121.0345600');
  assert.deepEqual(parseLocation('14.6531200, 121.0345600'), { lat: 14.65312, lng: 121.03456 });
  assert.equal(parseLocation('Quezon City'), null);
  assert.equal(parseLocation('200, 121'), null, 'not a latitude');

  const d = addShop(EMPTY_FIELDWORK, { id: 'new-1', lat: 14, lng: 121, accuracy: 18, createdAt: 1, values: { name: 'X' } });
  const moved = moveNewShop(d, 'new-1', 14.5, 121.5);
  assert.deepEqual([moved.added[0].lat, moved.added[0].lng, moved.added[0].accuracy], [14.5, 121.5, null]);

  /* A moved listed shop is one log entry, and survives a backup round trip. */
  const logged = recordEdit(EMPTY_FIELDWORK, edit('e1', 'location', '14.0000000, 121.0000000', '14.0001000, 121.0002000'));
  assert.equal(currentValues(logged, 's1').location, '14.0001000, 121.0002000');
  assert.deepEqual(parseBackup(toBackup(logged, 5)), logged);
});
