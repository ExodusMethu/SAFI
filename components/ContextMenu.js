'use client';

import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus();
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Adjust position to stay in viewport
  const style = {
    left: Math.max(8, Math.min(x, window.innerWidth - 260)),
    top: Math.max(8, Math.min(y, window.innerHeight - Math.min(items.length * 40 + 16, window.innerHeight - 32) - 16)),
    maxHeight: 'calc(100dvh - 32px)',
    overflowY: 'auto',
  };

  return (
    <div className="context-menu" role="menu" aria-label="Song options" ref={ref} style={style}>
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="context-divider" />
        ) : (
          <button
            role="menuitem"
            disabled={item.disabled}
            key={i}
            className={`context-item ${item.danger ? 'danger' : ''}`}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.icon && <span>{item.icon}</span>}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
