const paths = {
  music: 'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3Zm12-2a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3Z',
  home: 'm3 10 9-7 9 7v10H15v-7H9v7H3Z',
  library: 'M4 4v16M8 4v16M13 5l6-1 3 15-6 1Z',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4',
  play: 'm8 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
};
export default function Icon({ name = 'music', size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.music} /></svg>;
}
