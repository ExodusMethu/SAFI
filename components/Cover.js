'use client';
import { useState } from 'react';
import Icon from './Icon';
export default function Cover({ src, title = '', className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const hue = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return <div className={`cover ${className}`} style={{ '--cover-hue': hue }}>
    {src && failedSrc !== src ? <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} /> : <Icon name="music" size={36} />}
  </div>;
}
