import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('tour.js', 'utf8').split('(() => {')[0];
const context = vm.createContext({});
vm.runInContext(source, context);
const steps = context.pocketTourSteps();
const app = ['app.html', ...fs.readdirSync('.').filter(name => name.endsWith('.js') && name !== 'tour.js')].map(name => fs.readFileSync(name, 'utf8')).join('\n');

test('tour starts with a welcome, ends with a finish step, and explains every tab', () => {
  assert.equal(steps[0].target, undefined);
  assert.equal(steps.at(-1).last, true);
  for (const name of ['Overview', 'Business Trip', 'Reimbursable', 'Personal Buying', 'Monthly Travelling', 'Leaves', 'Mini tools', 'EMI']) {
    assert.ok(steps.some(step => step.target === `nav button[data-tab="${name}"]`), name + ' tab is explained');
  }
  for (const step of steps) assert.ok(step.title && step.text.length > 20, step.title);
});

test('every highlighted element exists in the app', () => {
  for (const step of steps.filter(step => step.target)) {
    for (const id of step.target.match(/#[\w-]+/g) || []) assert.ok(app.includes(`id="${id.slice(1)}"`) || app.includes(`id = '${id.slice(1)}'`), step.target);
    for (const cls of step.target.match(/\.[\w-]+/g) || []) assert.ok(app.includes(cls.slice(1)), step.target);
  }
});
