'use client';

import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  // Adjust position to stay in viewport
  const style = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - items.length * 40 - 20),
  };

  return (
    <div className="context-menu" ref={ref} style={style}>
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="context-divider" />
        ) : (
          <button
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
