function message(reason: unknown): string {
  return reason instanceof Error && reason.message
    ? reason.message
    : 'Could not reach Supabase.';
}

export function showStartupError(reason: unknown): void {
  const host = document.querySelector('app-root');
  if (!host) { return; }

  host.replaceChildren();

  const box = document.createElement('div');
  box.className = 'startup-error';

  const heading = document.createElement('h1');
  heading.textContent = 'Practice is unavailable';

  const detail = document.createElement('p');

  detail.textContent = message(reason);

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => location.reload());

  box.append(heading, detail, retry);
  host.append(box);
}
