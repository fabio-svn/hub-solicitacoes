window.showApiError = async function(res, fallback = 'Ocorreu um erro inesperado.') {
  let msg = fallback;
  try {
    const data = await res.clone().json();
    if (data && data.error) msg = data.error;
  } catch (_) {}
  if (window.showToast) {
    window.showToast(msg, 'error', 5000);
  } else {
    alert(msg);
  }
};

window.apiFetch = async function(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) {
    await window.showApiError(res);
    return null;
  }
  return res;
};
