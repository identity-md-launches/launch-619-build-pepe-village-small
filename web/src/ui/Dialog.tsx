import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  eyebrow?: string;
  /** `sheet` docks to the bottom and keeps the scene visible; `center` dims it. */
  variant?: 'sheet' | 'center';
  children: ReactNode;
  closeLabel?: string;
}

/**
 * Native <dialog> shown with showModal(): the browser traps focus, makes the
 * page inert, closes on Escape and restores focus to the previous element.
 */
export function Dialog({ open, onClose, title, eyebrow, variant = 'center', children, closeLabel = 'Close' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${variant}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (outside the inner panel) closes the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-panel">
        <header className="dialog-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label={closeLabel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
