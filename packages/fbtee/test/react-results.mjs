import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, Fragment, isValidElement, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { createRoot, hydrateRoot } = await import('react-dom/client');
const { createFbteeRuntime } = await import('fbtee');

function runtime() {
  return createFbteeRuntime({ locale: 'en-US', translations: {} });
}

test('production and development preserve stateful children across translation updates', () => {
  const { fbt } = runtime();
  let mounts = 0;
  let unmounts = 0;
  function Input() {
    useEffect(() => {
      mounts++;
      return () => unmounts++;
    }, []);
    return createElement('input', { defaultValue: 'initial' });
  }
  const message = (name) =>
    fbt._(
      'Hello {name} {input}',
      [fbt._param('name', name), fbt._param('input', createElement(Input))],
      { hk: 'greeting' },
    );
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    flushSync(() => root.render(message('Alice')));
    const input = container.querySelector('input');
    input.value = 'edited';
    flushSync(() => root.render(message('Bob')));
    assert.equal(container.textContent, 'Hello Bob ');
    assert.equal(container.querySelector('input'), input);
    assert.equal(input.value, 'edited');
    assert.equal(mounts, 1);
    assert.equal(unmounts, 0);
  } finally {
    flushSync(() => root.unmount());
  }
});

test(
  'plain and rich translations hydrate without replacing server-rendered nodes',
  { timeout: 5000 },
  async () => {
    const { fbs, fbt } = runtime();
    const result = (name) =>
      fbt._('Hello {name}', [fbt._param('name', createElement('b', null, name))], {
        hk: 'greeting',
      });
    assert.ok(isValidElement(result('Alice')));
    assert.equal(result('Alice').type, Fragment);
    const ready = Promise.withResolvers();
    function Message({ name }) {
      useEffect(() => ready.resolve(), []);
      return createElement(
        'p',
        null,
        fbt._('Welcome. '),
        result(name),
        createElement('input', { defaultValue: 'initial', placeholder: fbs._('Name') }),
      );
    }
    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(Message, { name: 'Alice' }));
    const bold = container.querySelector('b');
    const input = container.querySelector('input');
    const errors = [];
    const root = hydrateRoot(container, createElement(Message, { name: 'Alice' }), {
      onRecoverableError: (error) => errors.push(error),
    });
    try {
      await ready.promise;
      assert.equal(container.querySelector('b'), bold);
      assert.equal(container.querySelector('input'), input);
      input.value = 'edited';
      flushSync(() => root.render(createElement(Message, { name: 'Bob' })));
      assert.equal(container.querySelector('b'), bold);
      assert.equal(bold.textContent, 'Bob');
      assert.equal(input.value, 'edited');
      assert.deepEqual(errors, []);
    } finally {
      flushSync(() => root.unmount());
    }
  },
);
