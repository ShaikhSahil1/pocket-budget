import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('app.html', 'utf8');
const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(match => match[1]);

test('app.html loads every feature script in one fixed order', () => {
  const before = (a, b) => assert.ok(scripts.indexOf(a) >= 0 && scripts.indexOf(a) < scripts.indexOf(b), `${a} must load before ${b}`);
  before('account-storage.js', 'app.js');
  before('categories.js', 'app.js');
  before('app.js', 'leaves.js');
  before('leaves.js', 'backup-validation.js');
  before('backup-validation.js', 'google-account-sync.js');
  before('backup-validation.js', 'emi.js');
  before('mini-tools.js', 'mini-tool-cards.js');
  before('vendor/jsQR.js', 'upi-payment.js');
  for (const name of ['emi.js', 'upi-payment.js', 'chat.js']) assert.ok(scripts.includes(name), name + ' is listed in app.html');
  assert.equal(new Set(scripts).size, scripts.length);
  assert.ok(html.includes('href="chat.css"'));
});

test('feature scripts no longer inject other local scripts at runtime', () => {
  for (const file of fs.readdirSync('.').filter(name => name.endsWith('.js'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\.src\s*=\s*'([^']+)'/g)) assert.match(match[1], /^https:\/\//, `${file} loads ${match[1]} dynamically`);
  }
});
