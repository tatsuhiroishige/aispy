import { describe, it, expect } from 'vitest';
import {
  extractForms,
  encodeFormData,
  buildSubmitUrl,
  type FormSpec,
} from './forms.js';

describe('extractForms', () => {
  it('extracts a simple GET search form', async () => {
    const html = `<form action="/search" method="get">
      <input type="search" name="q" placeholder="Search">
    </form>`;
    const forms = await extractForms(html, 'https://example.com/page');
    expect(forms).toHaveLength(1);
    expect(forms[0]!.method).toBe('get');
    expect(forms[0]!.action).toBe('https://example.com/search');
    expect(forms[0]!.fields[0]).toMatchObject({
      name: 'q',
      type: 'search',
      placeholder: 'Search',
    });
  });

  it('preserves hidden fields alongside visible ones', async () => {
    const html = `<form action="/login" method="post">
      <input type="hidden" name="csrf" value="abc">
      <input type="text" name="user">
      <input type="password" name="pw">
    </form>`;
    const forms = await extractForms(html, 'https://x.com');
    expect(forms[0]!.fields.map((f) => f.name)).toEqual(['csrf', 'user', 'pw']);
    expect(forms[0]!.method).toBe('post');
  });

  it('skips forms with only hidden/submit fields', async () => {
    const html = `<form action="/"><input type="hidden" name="t"></form>`;
    const forms = await extractForms(html, 'https://x.com');
    expect(forms).toHaveLength(0);
  });

  it('parses textarea as text type', async () => {
    const html = `<form action="/"><textarea name="msg">hello</textarea></form>`;
    const forms = await extractForms(html, 'https://x.com');
    expect(forms[0]!.fields[0]).toMatchObject({
      name: 'msg',
      type: 'text',
      value: 'hello',
    });
  });
});

describe('encodeFormData / buildSubmitUrl', () => {
  const form: FormSpec = {
    action: 'https://example.com/search',
    method: 'get',
    fields: [
      { name: 'q', type: 'search', value: 'hello world', placeholder: '', required: false },
      { name: 'lang', type: 'text', value: 'en', placeholder: '', required: false },
    ],
  };

  it('encodes as urlencoded with %20 for space', () => {
    const encoded = encodeFormData(form.fields);
    expect(encoded).toContain('q=hello+world');
    expect(encoded).toContain('lang=en');
  });

  it('appends query string on GET', () => {
    expect(buildSubmitUrl(form)).toBe('https://example.com/search?q=hello+world&lang=en');
  });

  it('does not duplicate ? when action already has query', () => {
    const f = { ...form, action: 'https://example.com/search?source=bar' };
    expect(buildSubmitUrl(f)).toBe(
      'https://example.com/search?source=bar&q=hello+world&lang=en',
    );
  });

  it('POST returns action without modification', () => {
    const f: FormSpec = { ...form, method: 'post' };
    expect(buildSubmitUrl(f)).toBe('https://example.com/search');
  });

  it('omits submit-type fields from encoding', () => {
    const f: FormSpec = {
      ...form,
      fields: [
        ...form.fields,
        { name: 'submitBtn', type: 'submit', value: 'Go', placeholder: '', required: false },
      ],
    };
    expect(encodeFormData(f.fields)).not.toContain('submitBtn');
  });
});
