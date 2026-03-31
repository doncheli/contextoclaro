const CACHE_NAME = 'cc-v1'
const PRECACHE = ['/', '/logo.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok && e.request.url.startsWith(self.location.origin)) {
        const clone = resp.clone()
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
      }
      return resp
    }).catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Contexto Claro', {
      body: data.body || 'Nueva noticia verificada',
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: data.url || '/' },
      actions: [{ action: 'open', title: 'Ver noticia' }],
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})
