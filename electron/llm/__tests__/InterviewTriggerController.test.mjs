import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../../dist-electron/electron/InterviewTriggerController.js');
const { InterviewTriggerController } = await import(pathToFileURL(distPath).href);

test('fires trigger after configured silence threshold (system audio)', async () => {
    const capture = new EventEmitter();
    let fired = false;
    const ctrl = new InterviewTriggerController(capture, () => { fired = true; }, 50);
    ctrl.attach();
    capture.emit('speech_ended');
    await wait(80);
    assert.equal(fired, true);
    ctrl.detach();
});

test('new audio data cancels pending trigger', async () => {
    const capture = new EventEmitter();
    let fired = false;
    const ctrl = new InterviewTriggerController(capture, () => { fired = true; }, 100);
    ctrl.attach();
    capture.emit('speech_ended');
    await wait(40);
    capture.emit('data', Buffer.alloc(8)); // speech resumed
    await wait(80);
    assert.equal(fired, false, 'trigger must not fire after data event cancels the timer');
    ctrl.detach();
});

test('trigger does not fire after detach()', async () => {
    const capture = new EventEmitter();
    let fired = false;
    const ctrl = new InterviewTriggerController(capture, () => { fired = true; }, 50);
    ctrl.attach();
    ctrl.detach();
    capture.emit('speech_ended');
    await wait(80);
    assert.equal(fired, false);
});

test('manual cancel() clears pending timer', async () => {
    const capture = new EventEmitter();
    let fired = false;
    const ctrl = new InterviewTriggerController(capture, () => { fired = true; }, 50);
    ctrl.attach();
    capture.emit('speech_ended');
    ctrl.cancel();
    await wait(80);
    assert.equal(fired, false);
    ctrl.detach();
});

test('re-attaching after detach works correctly', async () => {
    const capture = new EventEmitter();
    let count = 0;
    const ctrl = new InterviewTriggerController(capture, () => { count++; }, 50);
    ctrl.attach();
    capture.emit('speech_ended');
    await wait(80);
    assert.equal(count, 1);
    ctrl.detach();
    ctrl.attach();
    capture.emit('speech_ended');
    await wait(80);
    assert.equal(count, 2, 're-attached controller must fire again');
    ctrl.detach();
});
