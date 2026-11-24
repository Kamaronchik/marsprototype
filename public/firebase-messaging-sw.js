// Service worker for push notifications (Firebase Cloud Messaging).
// The server sends a data-only message { title, body, link }; this file shows it and opens the link on click.

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json().data || {} : {};
  } catch {
    data = {};
  }
  if (!data.title) return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      icon: '/apple-touch-icon.png',
      data: { link: data.link || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        open.focus();
        return open.navigate(link).catch(() => self.clients.openWindow(link));
      }
      return self.clients.openWindow(link);
    }),
  );
});
