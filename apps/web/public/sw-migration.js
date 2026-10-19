// Remove the previous worker's broad runtime cache when the new worker activates.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('ethio-underground-v1'));
});
