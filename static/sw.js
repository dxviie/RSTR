self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', () => {
	self.clients.claim();
	self.registration.unregister().then(() => {
		console.log('Service worker unregistered');
	});
});