/**
 * الاتصال بالخادم — طلب واحد لكل عملية، بدون retry تلقائي وبدون polling.
 * Content-Type: text/plain لتجنب CORS preflight مع Apps Script.
 */
class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const Api = {
  token: sessionStorage.getItem('altayeb.token') || '',
  onAuthLost: null,

  setToken(t) {
    this.token = t || '';
    if (t) sessionStorage.setItem('altayeb.token', t);
    else sessionStorage.removeItem('altayeb.token');
  },

  newRequestId() {
    return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  },

  /** opts.requestId: لنفس عملية الكتابة عند إعادة المحاولة يدويًا — الخادم لا ينفذها مرتين */
  async call(action, payload, opts) {
    const url = APP_CONFIG.API_URL;
    if (!/^https:\/\//.test(url)) throw new ApiError('CONFIG', 'رابط الخادم غير مضبوط في js/config.js.');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), APP_CONFIG.REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: this.token, payload: payload || {}, requestId: (opts && opts.requestId) || '' }),
        signal: ctrl.signal
      });
    } catch (e) {
      throw new ApiError('NETWORK', e.name === 'AbortError'
        ? 'الخادم لم يرد في الوقت المحدد. لو كانت عملية حفظ، يمكنك الضغط على حفظ مرة أخرى بأمان.'
        : 'تعذر الاتصال بالخادم. تأكد من اتصال الإنترنت.');
    } finally {
      clearTimeout(timer);
    }

    let body;
    try { body = await res.json(); }
    catch (e) { throw new ApiError('BAD_RESPONSE', 'رد غير متوقع من الخادم. تأكد من نشر Apps Script ومن صحة الرابط.'); }

    if (!body || body.ok !== true) {
      const err = (body && body.error) || {};
      const code = err.code || 'SERVER_ERROR';
      if ((code === 'SESSION_EXPIRED' || code === 'UNAUTHENTICATED') && typeof this.onAuthLost === 'function') {
        this.onAuthLost(err.message);
      }
      throw new ApiError(code, err.message || 'حدث خطأ غير معروف.');
    }
    return body.data;
  }
};
