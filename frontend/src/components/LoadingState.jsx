import React from 'react';

export default function LoadingState({
  label = 'Memuat AutoBPMN...',
  description = '',
  variant = 'inline',
}) {
  return (
    <div
      className={`loading-state loading-state--${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loading-state__spinner" aria-hidden="true" />
      <span className="loading-state__label">{label}</span>
      {description && <span className="loading-state__description">{description}</span>}
    </div>
  );
}
