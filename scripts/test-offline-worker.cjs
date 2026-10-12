const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const worker = fs.readFileSync(require('node:path').join(__dirname, '../public/sw.js'), 'utf8');
const origin = 'https://safi.example';

function setup() {
  const handlers = {};
  const stores = new Map();
  let offline = false;
  let failAsset = false;
  let activated = false;
  let networkCalls = 0;
  const key = input => new URL(typeof input === 'string' ? input : input.url, origin).href;
  const fetch = async input => {
    networkCalls++;
    if (offline) throw new TypeError('Network unavailable');
    const pathname = new URL(key(input)).pathname;
    if (failAsset && pathname.endsWith('.js')) return new Response('missing', { status: 404 });
    return new Response(pathname === '/' ? '<html>SAFI</html>' : pathname, {
      headers: { 'content-type': pathname === '/' ? 'text/html' : 'text/plain' },
    });
  };
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(input) { return entries.get(key(input))?.clone(); },
        async put(input, response) { entries.set(key(input), response.clone()); },
        async addAll(inputs) {
          const responses = await Promise.all(inputs.map(fetch));
          if (responses.some(response => !response.ok)) throw new Error('Precache failed');
          inputs.forEach((input, i) => entries.set(key(input), responses[i]));
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    location: { origin }, SAFI_BUILD_ID: 'test-build',
    SAFI_OFFLINE_ASSETS: ['/_next/static/app.js', '/_next/static/app.css', '/_next/static/lazy.js'],
    addEventListener(name, handler) { handlers[name] = handler; },
    async skipWaiting() { activated = true; },
    clients: { async claim() {} },
  };
  vm.runInNewContext(worker, { self, caches, fetch, URL, Response, importScripts() {} });
  async function lifecycle(name) {
    let pending;
    handlers[name]({ waitUntil(value) { pending = value; } });
    await pending;
  }
  function request(path, options = {}) {
    let response;
    handlers.fetch({
      request: { url: new URL(path, origin).href, method: 'GET', mode: 'cors',
        headers: new Headers(), destination: '', ...options },
      respondWith(value) { response = value; }, waitUntil() {},
    });
    return response;
  }
  return { lifecycle, request, caches,
    goOffline() { offline = true; }, failAsset() { failAsset = true; },
    get activated() { return activated; }, get networkCalls() { return networkCalls; },
  };
}

test('first installation caches the shell and all chunks before activation', async () => {
  const app = setup();
  await app.lifecycle('install');
  assert.equal(app.activated, true);
  app.goOffline();
  const calls = app.networkCalls;
  const shell = await app.request('/?source=homescreen', { mode: 'navigate' });
  assert.match(await shell.text(), /SAFI/);
  for (const path of ['/_next/static/app.js', '/_next/static/app.css', '/_next/static/lazy.js']) {
    assert.equal(await (await app.request(path)).text(), path);
  }
  assert.equal(app.networkCalls, calls, 'Offline launches must not wait for the network');
});

test('a failed precache does not activate an incomplete update', async () => {
  const app = setup();
  app.failAsset();
  await assert.rejects(app.lifecycle('install'), /Precache failed/);
  assert.equal(app.activated, false);
});

test('API, audio, RSC, mutations and other pages bypass the app shell', () => {
  const app = setup();
  for (const [url, options] of [
    ['/api/tracks', {}], ['https://audio.r2.dev/song.mp3', {}],
    ['/?_rsc=abc', {}], ['/', { headers: new Headers({ RSC: '1' }) }],
    ['/', { method: 'POST' }], ['/missing', { mode: 'navigate' }],
  ]) assert.equal(app.request(url, options), undefined);
});

test('activation removes only previous SAFI caches', async () => {
  const app = setup();
  for (const name of ['safi-v3', 'safi-offline-old', 'another-app']) await app.caches.open(name);
  await app.lifecycle('install');
  await app.lifecycle('activate');
  assert.deepEqual((await app.caches.keys()).sort(), ['another-app', 'safi-offline-test-build']);
});
