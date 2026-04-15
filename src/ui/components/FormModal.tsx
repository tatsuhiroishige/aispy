import { Box, Text } from 'ink';
import type { FormSpec, FormField } from '../../browser/forms.js';

interface FormModalProps {
  form: FormSpec;
  values: Record<string, string>;
  focusedIndex: number;
  submitting?: boolean;
  error?: string;
}

function maskPassword(v: string): string {
  return '•'.repeat(v.length);
}

function displayValue(field: FormField, value: string, focused: boolean): string {
  const raw = value ?? '';
  const shown = field.type === 'password' ? maskPassword(raw) : raw;
  if (shown.length === 0) {
    return field.placeholder
      ? `(${field.placeholder})`
      : focused
        ? '_'
        : '';
  }
  return focused ? shown + '_' : shown;
}

export function FormModal({
  form,
  values,
  focusedIndex,
  submitting = false,
  error,
}: FormModalProps) {
  const editableFields = form.fields.filter(
    (f) => f.type !== 'hidden' && f.type !== 'submit',
  );

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="blue" paddingX={1}>
      <Text bold color="blue">
        Form › {form.method.toUpperCase()} {form.action}
      </Text>
      <Text dimColor>
        Tab/↓ next field · Shift-Tab/↑ prev · Enter submit · Esc cancel
      </Text>
      {editableFields.map((field, i) => {
        const focused = i === focusedIndex;
        const value = values[field.name] ?? field.value;
        return (
          <Box key={field.name}>
            <Text color={focused ? 'cyan' : 'gray'}>
              {focused ? '›' : ' '} {field.name.padEnd(14)}{' '}
            </Text>
            <Text color={focused ? 'white' : 'gray'}>[{field.type}]</Text>
            <Text> </Text>
            <Text color={focused ? 'yellow' : 'white'}>
              {displayValue(field, value, focused)}
            </Text>
            {field.required && !value && <Text color="red"> *</Text>}
          </Box>
        );
      })}
      {submitting && <Text color="yellow">◌ submitting…</Text>}
      {error && <Text color="red">✗ {error}</Text>}
    </Box>
  );
}
