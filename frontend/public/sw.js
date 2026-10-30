// RefPahang service worker: shows Web Push notifications (iPhone home-screen
// app and other browsers) and opens the right page when one is tapped.
// It caches nothing; the portal always loads from the network.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'RefPahang', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'RefPahang';
  const shown = self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  });
  const badge = typeof data.badge === 'number' && self.navigator.setAppBadge
    ? self.navigator.setAppBadge(data.badge).catch(() => undefined)
    : Promise.resolve();
  event.waitUntil(Promise.all([shown, badge]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
