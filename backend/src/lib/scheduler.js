let warned = false;

export function startWeeklyScheduler() {
  // Auto weekly matching is intentionally disabled.
  if (!warned) {
    warned = true;
    console.warn('Weekly scheduler is disabled: countdown is display-only.');
  }
}
