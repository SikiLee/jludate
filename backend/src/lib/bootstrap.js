let bootstrapped = false;

export function ensureServerBootstrap() {
  if (bootstrapped) {
    return;
  }

  bootstrapped = true;
}
