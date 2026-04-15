export interface FormField {
  name: string;
  type: 'text' | 'search' | 'email' | 'url' | 'password' | 'number' | 'hidden' | 'submit';
  value: string;
  placeholder: string;
  required: boolean;
}

export interface FormSpec {
  action: string;
  method: 'get' | 'post';
  fields: FormField[];
}

const SUPPORTED_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'password',
  'number',
  'hidden',
  'submit',
]);

function normalizeType(raw: string | null): FormField['type'] {
  const t = (raw ?? 'text').toLowerCase();
  if (SUPPORTED_INPUT_TYPES.has(t)) return t as FormField['type'];
  return 'text';
}

export async function extractForms(html: string, baseUrl: string): Promise<FormSpec[]> {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html, { url: baseUrl });
  const doc = dom.window.document;
  const forms: FormSpec[] = [];

  for (const form of Array.from(doc.querySelectorAll('form')) as HTMLFormElement[]) {
    const actionAttr = form.getAttribute('action') ?? '';
    let action: string;
    try {
      action = new URL(actionAttr || baseUrl, baseUrl).toString();
    } catch {
      continue;
    }
    const method = (form.getAttribute('method') ?? 'get').toLowerCase() as 'get' | 'post';

    const fields: FormField[] = [];
    for (const el of Array.from(form.querySelectorAll('input,textarea'))) {
      const name = el.getAttribute('name');
      if (!name) continue;
      let type: FormField['type'];
      let value: string;
      if (el.tagName === 'TEXTAREA') {
        type = 'text';
        value = el.textContent ?? '';
      } else {
        type = normalizeType(el.getAttribute('type'));
        value = el.getAttribute('value') ?? '';
      }
      const placeholder = el.getAttribute('placeholder') ?? '';
      const required = el.hasAttribute('required');
      fields.push({ name, type, value, placeholder, required });
    }

    if (fields.some((f) => f.type !== 'hidden' && f.type !== 'submit')) {
      forms.push({ action, method: method === 'post' ? 'post' : 'get', fields });
    }
  }

  return forms;
}

export function encodeFormData(fields: FormField[]): string {
  const params = new URLSearchParams();
  for (const f of fields) {
    if (f.type === 'submit') continue;
    params.append(f.name, f.value);
  }
  return params.toString();
}

export function buildSubmitUrl(form: FormSpec): string {
  if (form.method === 'get') {
    const encoded = encodeFormData(form.fields);
    if (!encoded) return form.action;
    return form.action + (form.action.includes('?') ? '&' : '?') + encoded;
  }
  return form.action;
}
