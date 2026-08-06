"use client";
import { useId } from "react";

// ONE labelled form control for both frontends.
//
// The platform had 18 inputs, selects and textareas and zero <label> elements —
// every field relied on a placeholder, which disappears the moment you type,
// is not reliably announced by screen readers, and fails WCAG 3.3.2. This
// supplies the label, the htmlFor/id pairing, the required marker, helper text,
// the error message and its aria-describedby wiring, so no call site has to
// remember any of it.
//
// Unstyled beyond layout: colours come from whichever surface it renders in
// (.portal or .sr), so a field looks native to its page rather than importing a
// third visual language.

type Common = {
  label: string;
  /** Visually hides the label while keeping it for assistive tech. */
  hideLabel?: boolean;
  helper?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Shows a spinner in the control and marks it aria-busy. */
  loading?: boolean;
  /** Layout class for the wrapper (width, flex sizing). */
  className?: string;
  /**
   * Extra class on the control itself, so an existing toolbar input can keep
   * the visual styling it already had while still gaining a real label. Lets a
   * control migrate here without a paired CSS rewrite.
   */
  inputClassName?: string;
};

type InputProps = Common & {
  as?: "input";
  type?: "text" | "email" | "password" | "url" | "number" | "search";
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "required" | "disabled" | "className">;

type TextareaProps = Common & { as: "textarea" } &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "required" | "disabled" | "className">;

type SelectProps = Common & { as: "select"; children: React.ReactNode } &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "required" | "disabled" | "className">;

type ToggleProps = Common & { as: "checkbox" | "radio" | "switch" } &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "required" | "disabled" | "className">;

export type FieldProps = InputProps | TextareaProps | SelectProps | ToggleProps;

export default function Field(props: FieldProps) {
  const reactId = useId();
  const id = (props as { id?: string }).id || `f${reactId}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  const { label, hideLabel, helper, error, required, disabled, loading, className = "", inputClassName = "" } = props;
  const as = ("as" in props && props.as) || "input";
  const isToggle = as === "checkbox" || as === "radio" || as === "switch";

  // Only reference description ids that are actually rendered, or screen
  // readers announce a dangling reference.
  const describedBy = [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    disabled: disabled || loading,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-busy": loading || undefined,
  } as const;

  const labelEl = (
    <label htmlFor={id} className={`fld-label ${hideLabel ? "fld-sr" : ""}`}>
      {label}
      {required && <span className="fld-req" aria-hidden="true">*</span>}
      {required && <span className="fld-sr"> (required)</span>}
    </label>
  );

  // Toggles put the control before the label — the standard reading order for
  // a checkbox or switch, and the whole row becomes the click target.
  if (isToggle) {
    const { as: _as, label: _l, hideLabel: _h, helper: _hp, error: _e, required: _r,
      disabled: _d, loading: _ld, className: _c, inputClassName: _ic, ...rest } = props as ToggleProps;
    void [_as, _l, _h, _hp, _e, _r, _d, _ld, _c, _ic];
    return (
      <div className={`fld fld-toggle ${error ? "is-error" : ""} ${className}`.trim()}>
        <div className="fld-toggle-row">
          <input
            {...rest}
            {...shared}
            type={as === "radio" ? "radio" : "checkbox"}
            role={as === "switch" ? "switch" : undefined}
            className={as === "switch" ? "fld-switch" : "fld-check"}
          />
          <label htmlFor={id} className="fld-label fld-label-inline">
            {label}
            {required && <span className="fld-req" aria-hidden="true">*</span>}
          </label>
        </div>
        <FieldMessages helper={helper} helperId={helperId} error={error} errorId={errorId} />
      </div>
    );
  }

  let control: React.ReactNode;
  if (as === "textarea") {
    const { as: _as, label: _l, hideLabel: _h, helper: _hp, error: _e, required: _r,
      disabled: _d, loading: _ld, className: _c, inputClassName: _ic, ...rest } = props as TextareaProps;
    void [_as, _l, _h, _hp, _e, _r, _d, _ld, _c, _ic];
    control = <textarea {...rest} {...shared} className={`fld-input fld-textarea ${inputClassName}`.trim()} />;
  } else if (as === "select") {
    const { as: _as, label: _l, hideLabel: _h, helper: _hp, error: _e, required: _r,
      disabled: _d, loading: _ld, className: _c, inputClassName: _ic, children, ...rest } = props as SelectProps;
    void [_as, _l, _h, _hp, _e, _r, _d, _ld, _c, _ic];
    control = <select {...rest} {...shared} className={`fld-input fld-select ${inputClassName}`.trim()}>{children}</select>;
  } else {
    const { as: _as, label: _l, hideLabel: _h, helper: _hp, error: _e, required: _r,
      disabled: _d, loading: _ld, className: _c, inputClassName: _ic, type = "text", ...rest } = props as InputProps;
    void [_as, _l, _h, _hp, _e, _r, _d, _ld, _c, _ic];
    control = <input {...rest} {...shared} type={type} className={`fld-input ${inputClassName}`.trim()} />;
  }

  return (
    <div className={`fld ${error ? "is-error" : ""} ${className}`.trim()}>
      {labelEl}
      <div className="fld-control">
        {control}
        {loading && <span className="fld-spinner" aria-hidden="true" />}
      </div>
      <FieldMessages helper={helper} helperId={helperId} error={error} errorId={errorId} />
    </div>
  );
}

function FieldMessages({ helper, helperId, error, errorId }: {
  helper?: string; helperId: string; error?: string | null; errorId: string;
}) {
  return (
    <>
      {/* Helper stays visible alongside an error: it usually explains the
          format the error is complaining about. */}
      {helper && <p id={helperId} className="fld-helper">{helper}</p>}
      {error && (
        // role="alert" so a validation failure is announced the moment it
        // appears, without moving focus away from what the user is typing.
        <p id={errorId} className="fld-error" role="alert">{error}</p>
      )}
    </>
  );
}

/**
 * Moves focus to the first field with an error and brings it into view.
 * Called after a failed submit so the user lands on the problem instead of
 * hunting for it. Presentation only — validation itself stays with the caller.
 */
export function focusFirstError(container?: HTMLElement | null) {
  const root = container || document;
  const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!invalid) return false;
  invalid.scrollIntoView({ block: "center", behavior: "smooth" });
  invalid.focus({ preventScroll: true });
  return true;
}
