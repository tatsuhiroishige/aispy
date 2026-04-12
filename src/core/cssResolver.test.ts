import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';

function resolve(html: string, selector: string) {
  const dom = new JSDOM(html);
  const resolver = createStyleResolver(dom.window.document);
  const el = dom.window.document.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return resolver.getComputedStyle(el);
}

describe('cssResolver', () => {
  it('returns tag defaults for <p>', () => {
    const style = resolve('<body><p>Hello</p></body>', 'p');
    expect(style.display).toBe('block');
    expect(style.fontWeight).toBe('normal');
  });

  it('returns tag defaults for <h1> (bold, block)', () => {
    const style = resolve('<body><h1>Title</h1></body>', 'h1');
    expect(style.display).toBe('block');
    expect(style.fontWeight).toBe('bold');
  });

  it('returns inline defaults for <span>', () => {
    const style = resolve('<body><span>text</span></body>', 'span');
    expect(style.display).toBe('inline');
  });

  it('returns base defaults for unknown tags', () => {
    const style = resolve('<body><custom-el>x</custom-el></body>', 'custom-el');
    expect(style.display).toBe('inline');
    expect(style.visibility).toBe('visible');
  });

  it('applies <style> rule with class selector', () => {
    const html = `
      <head><style>.hidden { display: none }</style></head>
      <body><div class="hidden">Secret</div></body>
    `;
    const style = resolve(html, '.hidden');
    expect(style.display).toBe('none');
  });

  it('applies <style> rule with tag selector', () => {
    const html = `
      <head><style>p { font-weight: bold }</style></head>
      <body><p>Bold paragraph</p></body>
    `;
    const style = resolve(html, 'p');
    expect(style.fontWeight).toBe('bold');
  });

  it('applies inline style attribute', () => {
    const html = '<body><div style="display:none">Hidden</div></body>';
    const style = resolve(html, 'div');
    expect(style.display).toBe('none');
  });

  it('inline style overrides stylesheet rule (specificity)', () => {
    const html = `
      <head><style>div { display: flex }</style></head>
      <body><div style="display: block">Content</div></body>
    `;
    const style = resolve(html, 'div');
    expect(style.display).toBe('block');
  });

  it('class selector overrides tag selector (specificity)', () => {
    const html = `
      <head><style>
        div { display: flex }
        .container { display: block }
      </style></head>
      <body><div class="container">Content</div></body>
    `;
    const style = resolve(html, '.container');
    expect(style.display).toBe('block');
  });

  it('ID selector overrides class selector (specificity)', () => {
    const html = `
      <head><style>
        .item { color: red }
        #main { color: blue }
      </style></head>
      <body><div class="item" id="main">Content</div></body>
    `;
    const style = resolve(html, '#main');
    expect(style.color).toBe('blue');
  });

  it('matches combined tag+class selector', () => {
    const html = `
      <head><style>div.special { visibility: hidden }</style></head>
      <body>
        <div class="special">Hidden div</div>
        <span class="special">Visible span</span>
      </body>
    `;
    const dom = new JSDOM(html);
    const resolver = createStyleResolver(dom.window.document);
    const div = dom.window.document.querySelector('div.special')!;
    const span = dom.window.document.querySelector('span.special')!;
    expect(resolver.getComputedStyle(div).visibility).toBe('hidden');
    expect(resolver.getComputedStyle(span).visibility).toBe('visible');
  });

  it('merges multiple <style> blocks', () => {
    const html = `
      <head>
        <style>.a { display: none }</style>
        <style>.b { visibility: hidden }</style>
      </head>
      <body>
        <div class="a">A</div>
        <div class="b">B</div>
      </body>
    `;
    const dom = new JSDOM(html);
    const resolver = createStyleResolver(dom.window.document);
    const a = dom.window.document.querySelector('.a')!;
    const b = dom.window.document.querySelector('.b')!;
    expect(resolver.getComputedStyle(a).display).toBe('none');
    expect(resolver.getComputedStyle(b).visibility).toBe('hidden');
  });

  it('ignores unknown CSS properties gracefully', () => {
    const html = `
      <head><style>p { -webkit-transform: rotate(45deg); z-index: 10; display: flex }</style></head>
      <body><p>Content</p></body>
    `;
    const style = resolve(html, 'p');
    expect(style.display).toBe('flex');
    // Unknown properties should not cause errors
    expect(style.fontWeight).toBe('normal');
  });

  it('handles malformed CSS without throwing', () => {
    const html = `
      <head><style>this is { not valid css !!!</style></head>
      <body><p>Content</p></body>
    `;
    // Should not throw
    const style = resolve(html, 'p');
    expect(style.display).toBe('block');
  });

  it('handles malformed inline style without throwing', () => {
    const html = '<body><div style="display::: broken;">Content</div></body>';
    const style = resolve(html, 'div');
    // Should return defaults rather than throwing
    expect(style.visibility).toBe('visible');
  });

  it('parses white-space property', () => {
    const html = `
      <head><style>.code { white-space: pre }</style></head>
      <body><div class="code">Code block</div></body>
    `;
    const style = resolve(html, '.code');
    expect(style.whiteSpace).toBe('pre');
  });

  it('parses text-align property', () => {
    const html = `
      <head><style>.center { text-align: center }</style></head>
      <body><div class="center">Centered</div></body>
    `;
    const style = resolve(html, '.center');
    expect(style.textAlign).toBe('center');
  });

  it('handles margin shorthand', () => {
    const html = `
      <head><style>.spaced { margin: 16px }</style></head>
      <body><div class="spaced">Content</div></body>
    `;
    const style = resolve(html, '.spaced');
    expect(style.marginTop).toBe(2);
    expect(style.marginBottom).toBe(2);
  });

  it('caches computed styles', () => {
    const dom = new JSDOM('<body><p>Test</p></body>');
    const resolver = createStyleResolver(dom.window.document);
    const el = dom.window.document.querySelector('p')!;
    const first = resolver.getComputedStyle(el);
    const second = resolver.getComputedStyle(el);
    expect(first).toBe(second); // Same reference (cached)
  });
});
