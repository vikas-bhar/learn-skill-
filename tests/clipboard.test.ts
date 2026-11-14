import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { copyTextToClipboard } from '../src/lib/clipboard.ts';

const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalDocumentDesc = Object.getOwnPropertyDescriptor(globalThis, 'document');

afterEach(() => {
  if (originalNavigatorDesc) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
  }
  if (originalDocumentDesc) {
    Object.defineProperty(globalThis, 'document', originalDocumentDesc);
  } else {
    delete (globalThis as { document?: unknown }).document;
  }
});

describe('copyTextToClipboard', () => {
  it('returns false immediately for empty strings', async () => {
    assert.equal(await copyTextToClipboard(''), false);
  });

  it('uses navigator.clipboard.writeText when permitted', async () => {
    let copiedText = '';
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: async (text: string) => {
            copiedText = text;
          },
        },
      },
    });

    const ok = await copyTextToClipboard('SkillPath notes');
    assert.equal(ok, true);
    assert.equal(copiedText, 'SkillPath notes');
  });

  it('falls back to document.execCommand when navigator.clipboard rejects and cleans up DOM element', async () => {
    let removed = false;
    let execCommandCalled = false;

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: async () => {
            throw new Error('NotAllowedError: Document is not focused');
          },
        },
      },
    });

    const fakeTextarea = {
      value: '',
      style: {} as Record<string, string>,
      parentNode: {
        removeChild: () => {
          removed = true;
        },
      },
      setAttribute: () => {},
      focus: () => {},
      select: () => {},
      setSelectionRange: () => {},
    };

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => fakeTextarea,
        body: { appendChild: () => {} },
        execCommand: (cmd: string) => {
          execCommandCalled = cmd === 'copy';
          return true;
        },
      },
    });

    const ok = await copyTextToClipboard('Fallback notes');
    assert.equal(ok, true);
    assert.equal(execCommandCalled, true);
    assert.equal(removed, true);
    assert.equal(fakeTextarea.value, 'Fallback notes');
  });

  it('returns false without throwing when both clipboard API and fallback fail', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: async () => {
            throw new Error('Blocked');
          },
        },
      },
    });
    delete (globalThis as { document?: unknown }).document;

    const ok = await copyTextToClipboard('Blocked notes');
    assert.equal(ok, false);
  });
});
