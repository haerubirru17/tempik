// Membuktikan aturan retensi: SEMUA domain temporary 30 menit (tanpa pengecualian permanen).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/db/queries.ts', import.meta.url), 'utf8');

assert.ok(src.includes("DELETE FROM messages WHERE received_at < datetime('now', '-30 minutes')"),
  'purge 30 menit untuk semua domain harus ada');
assert.ok(!src.includes('@berbirru.com'),
  'tidak boleh ada lagi pengecualian permanen untuk @berbirru.com');
assert.ok(/SELECT \* FROM messages WHERE inbox_address = \? AND received_at >= datetime/.test(src),
  'SELECT harus menyaring 30 menit untuk semua domain (tanpa OR pengecualian)');
assert.ok(src.includes("'-30 minutes'") && !src.includes('-30 days'),
  'jendela retensi tetap 30 menit');

console.log('OK — retensi uniform: semua domain (termasuk berbirru.com) temporary 30 menit');
