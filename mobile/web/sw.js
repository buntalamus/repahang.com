// Service worker for the RefPahang web app (/app/): shows Web Push
// notifications and opens the matching tab (./?screen=...) when one is tapped.
// It caches nothing, so every launch loads the latest deployed version.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'RefPahang', body: event.data ? event.data.text() : '' };
  }
  const shown = self.registration.showNotification(data.title || 'RefPahang', {
    body: data.body || '',
    icon: 'icons/Icon-192.png',
    badge: 'icons/Icon-192.png',
    tag: data.tag || undefined,
    data: { screen: data.screen || 'notifikasi' },
  });
  const badge = typeof data.badge === 'number' && self.navigator.setAppBadge
    ? self.navigator.setAppBadge(data.badge).catch(() => undefined)
    : Promise.resolve();
  event.waitUntil(Promise.all([shown, badge]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const screen = event.notification.data?.screen || 'notifikasi';
  const target = new URL(`./?screen=${encodeURIComponent(screen)}`, self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
