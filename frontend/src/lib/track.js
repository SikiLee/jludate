export function fireAndForgetTrack(payload) {
  try {
    const body = JSON.stringify(payload || {});
    const url = '/api/public/track';

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => null);
  } catch {
    // ignore analytics failures
  }
}
