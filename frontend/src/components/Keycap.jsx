import React from 'react';

/**
  Reusable Keycap shortcut guide component.
  Displays shortcut keys formatted as realistic desktop keycaps:
  [Button + shortcut guide keycap design]
 */
export default function Keycap({ keys = [], variant = 'default', className = '' }) {
  if (!keys || keys.length === 0) return null;

  const keyList = Array.isArray(keys) ? keys : [keys];
  const variantClass = variant !== 'default' ? `keycap-badge--${variant}` : '';

  return (
    <span className={`keycap-badge ${variantClass} ${className}`.trim()} aria-hidden="true">
      {keyList.map((k, index) => (
        <React.Fragment key={index}>
          <kbd className="keycap">{k}</kbd>
          {index < keyList.length - 1 && <span style={{ opacity: 0.5, fontSize: 9, margin: '0 1px' }}>+</span>}
        </React.Fragment>
      ))}
    </span>
  );
}
