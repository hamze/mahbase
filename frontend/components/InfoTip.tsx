import { help } from "@/lib/i18n/fa";

/** "i" icon that shows a short explanation with an example on hover or keyboard focus. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={text} data-tip={text}>
      i
    </span>
  );
}

/** Field caption with the field's ``help.<name>`` tooltip when one exists. */
export function FieldLabel({ field, children }: { field: string; children: string }) {
  const tip = help(field);
  return (
    <span className="field-label">
      {children}
      {tip && <InfoTip text={tip} />}
    </span>
  );
}
