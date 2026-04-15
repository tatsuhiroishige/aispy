import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { BrowserProvider, useBrowser } from './BrowserContext.js';
import type { NavigationUpdate } from '../../browser/navigator.js';

async function* fakeNavigate(url: string): AsyncGenerator<NavigationUpdate, void, void> {
  yield {
    ok: true,
    phase: 'final',
    entry: { url, title: `T-${url}`, content: `C-${url}` },
  };
}

async function* failNavigate(): AsyncGenerator<NavigationUpdate, void, void> {
  yield { ok: false, error: 'boom', phase: 'final' };
}

function Consumer({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useBrowser>) => void;
}) {
  const api = useBrowser();
  useEffect(() => {
    onReady(api);
  });
  const ce = api.currentEntry;
  return (
    <Text>
      tabs:{api.tabs.tabs.length} active:{api.activeTab?.id ?? 'none'} url:{ce?.url ?? '-'}
    </Text>
  );
}

describe('BrowserContext', () => {
  it('starts empty', () => {
    let captured: ReturnType<typeof useBrowser> | null = null;
    const { lastFrame } = render(
      <BrowserProvider navigateStreamFn={fakeNavigate}>
        <Consumer onReady={(a) => (captured = a)} />
      </BrowserProvider>,
    );
    expect(lastFrame()).toContain('tabs:0');
    expect(captured).not.toBeNull();
  });

  it('newTab with url creates tab and loads entry', async () => {
    let api: ReturnType<typeof useBrowser> | null = null;
    const { lastFrame } = render(
      <BrowserProvider navigateStreamFn={fakeNavigate}>
        <Consumer onReady={(a) => (api = a)} />
      </BrowserProvider>,
    );

    await act(async () => {
      await api!.newTab('https://example.com');
    });

    expect(lastFrame()).toContain('tabs:1');
    expect(lastFrame()).toContain('url:https://example.com');
  });

  it('navigate in active tab pushes history', async () => {
    let api: ReturnType<typeof useBrowser> | null = null;
    render(
      <BrowserProvider navigateStreamFn={fakeNavigate}>
        <Consumer onReady={(a) => (api = a)} />
      </BrowserProvider>,
    );
    await act(async () => {
      await api!.newTab('https://a.com');
    });
    await act(async () => {
      await api!.navigate('https://b.com');
    });
    expect(api!.activeTab?.history.entries.map((e) => e.url)).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('back/forward navigate within history', async () => {
    let api: ReturnType<typeof useBrowser> | null = null;
    render(
      <BrowserProvider navigateStreamFn={fakeNavigate}>
        <Consumer onReady={(a) => (api = a)} />
      </BrowserProvider>,
    );
    await act(async () => {
      await api!.newTab('https://a.com');
    });
    await act(async () => {
      await api!.navigate('https://b.com');
    });
    act(() => api!.back());
    expect(api!.currentEntry?.url).toBe('https://a.com');
    act(() => api!.forward());
    expect(api!.currentEntry?.url).toBe('https://b.com');
  });

  it('closeActiveTab removes tab', async () => {
    let api: ReturnType<typeof useBrowser> | null = null;
    render(
      <BrowserProvider navigateStreamFn={fakeNavigate}>
        <Consumer onReady={(a) => (api = a)} />
      </BrowserProvider>,
    );
    await act(async () => {
      await api!.newTab('https://a.com');
    });
    await act(async () => {
      await api!.newTab('https://b.com');
    });
    act(() => api!.closeActiveTab());
    expect(api!.tabs.tabs.length).toBe(1);
  });

  it('navigation error sets loadError on tab', async () => {
    let api: ReturnType<typeof useBrowser> | null = null;
    render(
      <BrowserProvider navigateStreamFn={failNavigate}>
        <Consumer onReady={(a) => (api = a)} />
      </BrowserProvider>,
    );
    await act(async () => {
      await api!.newTab('https://a.com');
    });
    expect(api!.activeTab?.loadError).toBe('boom');
  });

  it('streaming navigation pushes text first then upgrades to final', async () => {
    async function* twoPass(url: string): AsyncGenerator<NavigationUpdate, void, void> {
      yield {
        ok: true,
        phase: 'text',
        entry: { url, title: 'X', content: 'text-only', imagePrologue: '' },
      };
      yield {
        ok: true,
        phase: 'final',
        entry: { url, title: 'X', content: 'with images', imagePrologue: 'PROLOGUE' },
      };
    }

    let api: ReturnType<typeof useBrowser> | null = null;
    render(
      <BrowserProvider navigateStreamFn={twoPass}>
        <Consumer onReady={(a) => (api = a)} />
      </BrowserProvider>,
    );

    await act(async () => {
      await api!.newTab('https://progressive.com');
    });

    // History should have ONE entry (not 2), updated in place
    expect(api!.activeTab?.history.entries.length).toBe(1);
    expect(api!.currentEntry?.content).toBe('with images');
    expect(api!.currentEntry?.imagePrologue).toBe('PROLOGUE');
    expect(api!.activeTab?.loading).toBe(false);
  });

  it('addFetchedTab adds AI-fetched page as a new tab', async () => {
    let api: ReturnType<typeof useBrowser> | null = null;
    render(
      <BrowserProvider navigateStreamFn={fakeNavigate}>
        <Consumer onReady={(a) => (api = a)} />
      </BrowserProvider>,
    );
    act(() => {
      api!.addFetchedTab({ url: 'https://ai.com', title: 'ai', content: 'x' });
    });
    expect(api!.tabs.tabs.length).toBe(1);
    expect(api!.currentEntry?.url).toBe('https://ai.com');
  });
});
