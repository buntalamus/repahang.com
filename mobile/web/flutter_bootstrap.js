{{flutter_js}}
{{flutter_build_config}}

// No Flutter service worker: web/sw.js owns the /app/ scope for Web Push,
// and Flutter's (deprecated) worker unregisters whatever holds that scope.
_flutter.loader.load();
