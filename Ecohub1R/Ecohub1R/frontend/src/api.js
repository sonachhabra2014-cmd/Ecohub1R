const API_BASE = '';

// Auth Token Helpers
export function getToken() {
  return (
    localStorage.getItem('ecohub_token') ||
    sessionStorage.getItem('ecohub_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    ''
  );
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('ecohub_token', token);
    localStorage.setItem('token', token);
    sessionStorage.setItem('ecohub_token', token);
  } else {
    localStorage.removeItem('ecohub_token');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('ecohub_token');
  }
}

export function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('ecohub_user') || sessionStorage.getItem('ecohub_user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    const val = typeof user === 'string' ? user : JSON.stringify(user);
    localStorage.setItem('ecohub_user', val);
    localStorage.setItem('user', val);
    sessionStorage.setItem('ecohub_user', val);
  } else {
    localStorage.removeItem('ecohub_user');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    sessionStorage.removeItem('ecohub_user');
  }
}

// Universal API request wrapper
// Supports two calling conventions:
//   apiRequest('/api/endpoint', 'POST', dataObject)   ← legacy positional
//   apiRequest('/api/endpoint', { method, body, ... }) ← modern options object
export async function apiRequest(endpoint, methodOrOptions = 'GET', data = null) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let method, bodyStr;
  if (methodOrOptions && typeof methodOrOptions === 'object') {
    // Options object style
    method = methodOrOptions.method || 'GET';
    bodyStr = methodOrOptions.body || null;
    if (methodOrOptions.headers) {
      Object.assign(headers, methodOrOptions.headers);
    }
  } else {
    // Positional style
    method = methodOrOptions || 'GET';
    bodyStr = data ? JSON.stringify(data) : null;
  }

  const options = { method, headers };
  if (bodyStr && method !== 'GET') {
    options.body = bodyStr;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }

  return json;
}
