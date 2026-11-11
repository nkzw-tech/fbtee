import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react';
import {
  createRef,
  Fragment,
  isValidElement,
  ReactElement,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import createFbteeRuntime from '../createFbteeRuntime.tsx';
import type fbtInternal from '../fbt.tsx';
import getFbsResult from '../getFbsResult.tsx';
import getFbtResult from '../getFbtResult.tsx';
import type { FbsAPI, FbtAPI, FbtResult } from '../Types.ts';

function runtime() {
  return createFbteeRuntime({ locale: 'en-US', translations: {} })
    .fbt as unknown as typeof fbtInternal;
}

function children(result: FbtResult) {
  if (!isValidElement<{ children: ReadonlyArray<ReactNode> }>(result)) {
    throw new Error('Expected a rich result');
  }
  return result.props.children;
}

describe('React translation results', () => {
  it('returns strings for plain and nested text, including string coercion and JSON', () => {
    const fbt = runtime();
    const nested = fbt._('world');
    const result = fbt._('Hello {name}', [fbt._param('name', nested)]);
    expect(result).toBe('Hello world');
    expect(String(result)).toBe('Hello world');
    expect(JSON.stringify({ result })).toBe('{"result":"Hello world"}');
    expect(fbt._('')).toBe('');
  });

  it('applies normal punctuation handling to nested text translations', () => {
    const fbt = runtime();
    expect(fbt._('Hello {name}!', [fbt._param('name', fbt._('world!'))])).toBe('Hello world!');
  });

  it('creates real immutable keyed Fragments', () => {
    const result = getFbtResult(['Hello ', <b key="name">world</b>], 'greeting');
    expect(isValidElement(result)).toBe(true);
    expect(typeof result !== 'string' && result.type).toBe(Fragment);
    expect(typeof result !== 'string' && result.key).toBe('greeting');
    expect(Object.isFrozen(result)).toBe(true);
    expect(render(result).container.innerHTML).toBe('Hello <b>world</b>');
  });

  it('preserves child state, DOM identity, and refs when parameters change', () => {
    const fbt = runtime();
    const mounted = jest.fn();
    const unmounted = jest.fn<() => void>();
    const ref = createRef<HTMLInputElement>();
    function Child() {
      const [value, setValue] = useState('initial');
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return <input onChange={(event) => setValue(event.target.value)} ref={ref} value={value} />;
    }
    const message = (name: string) =>
      fbt._('Hello {name} {input}', [fbt._param('name', name), fbt._param('input', <Child />)], {
        hk: 'greeting',
      });
    const { container, rerender } = render(message('Alice'));
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'edited' } });
    rerender(message('Bob'));
    expect(container.textContent).toBe('Hello Bob ');
    expect(container.querySelector('input')).toBe(input);
    expect(ref.current).toBe(input);
    expect(input.value).toBe('edited');
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });

  it('preserves repeated parameter instances when translations reorder tokens', () => {
    const runtime = createFbteeRuntime({ locale: 'en-US', translations: {} });
    const fbt = runtime.fbt as unknown as typeof fbtInternal;
    const message = () =>
      fbt._(
        '{first} {second} {first}',
        [
          fbt._param('first', <input name="first" />),
          fbt._param('second', <input name="second" />),
        ],
        { hk: 'reordered' },
      );
    const { container, rerender } = render(message());
    const first = [...container.querySelectorAll('input')];
    first.forEach((input, index) => {
      input.value = `edited ${index}`;
    });
    runtime.mergeTranslations({ 'en-US': { reordered: '{second} {first} {first}' } });
    rerender(message());
    const reordered = [...container.querySelectorAll('input')];
    expect(reordered[0]).toBe(first[1]);
    expect(reordered[1]).toBe(first[0]);
    expect(reordered[2]).toBe(first[2]);
    expect(reordered.map((input) => input.value)).toEqual(['edited 1', 'edited 0', 'edited 2']);
  });

  it('resets the subtree when the message key changes', () => {
    const child = <input defaultValue="initial" key="input" />;
    const { container, rerender } = render(getFbtResult([child], 'first'));
    const input = container.querySelector('input')!;
    input.value = 'edited';
    rerender(getFbtResult([child], 'second'));
    expect(container.querySelector('input')).not.toBe(input);
    expect(container.querySelector('input')!.value).toBe('initial');
  });

  it('preserves explicit keys and clones unkeyed elements without modifying them', () => {
    const fbt = runtime();
    const ref = createRef<HTMLElement>();
    const plain = <strong ref={ref}>Alice</strong>;
    const keyed = <b key="bob">Bob</b>;
    const result = fbt._('{first} and {second}', [
      fbt._param('first', plain),
      fbt._param('second', keyed),
    ]);
    const [first, , second] = children(result);
    expect(first).not.toBe(plain);
    expect(plain.key).toBeNull();
    expect(isValidElement(first) && first.key).toBe('$fbtee-first-0$');
    expect(second).toBe(keyed);
    const { container } = render(result);
    expect(ref.current).toBe(container.querySelector('strong'));
  });

  it('uses distinct stable keys for repeated parameters', () => {
    const fbt = runtime();
    const message = () => fbt._('{name} and {name}', [fbt._param('name', <b>Alice</b>)]);
    const keys = (result: FbtResult) =>
      children(result)
        .filter(isValidElement)
        .map((child) => child.key);
    const first = keys(message());
    expect(new Set(first).size).toBe(2);
    expect(keys(message())).toEqual(first);
  });

  it('supports rich nested translations and arrays', () => {
    const fbt = runtime();
    const inner = fbt._('Hello {name}', [fbt._param('name', <b>Alice</b>)], { hk: 'inner' });
    const outer = fbt._(
      '{greeting}!',
      [fbt._param('greeting', [inner, <i key="suffix"> and Bob</i>])],
      { hk: 'outer' },
    );
    expect(render(outer).container.innerHTML).toBe('Hello <b>Alice</b><i> and Bob</i>!');
  });

  it('renders portals without copying their private fields', () => {
    const fbt = runtime();
    const target = document.createElement('div');
    const portal = createPortal(<b>Alice</b>, target, 'portal');
    const result = fbt._('Hello {name}', [fbt._param('name', portal)]);
    expect(children(result)[1]).toBe(portal);
    expect(render(result).container.textContent).toBe('Hello ');
    expect(target.innerHTML).toBe('<b>Alice</b>');
  });

  it('reports unsupported string serialization through the fbs listener', () => {
    const onStringSerializationError = jest.fn();
    const node = <b>rich</b>;
    expect(getFbsResult(['plain', [' text', node]], null, { onStringSerializationError })).toBe(
      'plain text',
    );
    expect(onStringSerializationError).toHaveBeenCalledWith(node);
  });

  it('exposes renderable fbt results and string-only fbs results to TypeScript', () => {
    const checks: [
      ReturnType<FbtAPI> extends string ? false : true,
      ReturnType<FbtAPI> extends ReactNode ? true : false,
      ReturnType<FbsAPI> extends string ? true : false,
      Parameters<FbsAPI['param']>[1] extends string | number ? true : false,
      ReactElement extends Parameters<FbsAPI['param']>[1] ? false : true,
      number extends NonNullable<Parameters<FbsAPI['list']>[1][number]> ? false : true,
    ] = [true, true, true, true, true, true];
    expect(checks.every(Boolean)).toBe(true);
  });
});
