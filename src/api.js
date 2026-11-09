let csrf = '';
let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function urlFor(path) {
  return `/api/index.php?r=${encodeURIComponent(path)}`;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'The server returned an unexpected response.' };
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;

  let response;
  try {
    response = await fetch(urlFor(path), {
      method,
      credentials: 'same-origin',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the site and the api folder are both published.');
  }

  const data = await readJson(response);
  if (data.csrf) csrf = data.csrf;

  if (response.status === 419) {
    const refreshed = await fetch(urlFor('/session'), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(readJson).catch(() => null);
    if (refreshed?.csrf) csrf = refreshed.csrf;
    throw new Error(data.error || 'Your session expired. Try again.');
  }

  if (response.status === 401 && path !== '/login') onUnauthorized();
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return data;
}
