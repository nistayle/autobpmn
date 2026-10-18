import React from 'react';

export default function ValidationBadge({ validation }) {
  if (!validation) return null;
  const { is_valid, issues = [], deadlocks = [], orphan_nodes = [] } = validation;

  return (
    <div className={`validation-card ${is_valid ? 'validation-card--valid' : 'validation-card--invalid'}`}>
      <svg className="validation-card__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        {is_valid
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        }
      </svg>
      <div className="validation-card__body">
        <div className="validation-card__title">
          {is_valid ? 'Alur tervalidasi' : 'Anomali terdeteksi'}
        </div>
        {!is_valid && issues.length > 0 && (
          <ul className="validation-card__list">
            {issues.slice(0, 5).map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        )}
        {deadlocks.length > 0 && (
          <div className="validation-card__detail">
            <span className="validation-card__detail-label">Deadlock</span>
            <ul className="validation-card__list">
              {deadlocks.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
        {orphan_nodes.length > 0 && (
          <div className="validation-card__detail">
            <span className="validation-card__detail-label">Node terisolasi</span>
            <ul className="validation-card__list">
              {orphan_nodes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}