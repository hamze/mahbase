import React from 'react';

const asMessages = (value) => [].concat(value).flat(Infinity).filter((v) => typeof v === 'string');

/**
 * Split an ``ApiError`` into per-field messages (for ``fields``) and the rest (``general``), so forms can show
 * DRF validation errors next to their inputs.
 */
export function splitApiErrors(error, fields) {
  const data = error.data && typeof error.data === 'object' && !Array.isArray(error.data) ? error.data : null;
  if (!data) return { general: error.messages?.length ? error.messages : ['ارتباط با سرور برقرار نشد. دوباره تلاش کنید.'] };
  const result = { general: [] };
  Object.entries(data).forEach(([key, value]) => {
    if (fields.includes(key)) result[key] = asMessages(value);
    else result.general.push(...asMessages(value));
  });
  return result;
}

export function FieldError({ errors, name }) {
  const messages = errors?.[name];
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages.join(' ')}</p>;
}

export function GeneralError({ errors }) {
  if (!errors?.general?.length) return null;
  return <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{errors.general.join(' ')}</p>;
}
