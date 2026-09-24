/** شاشة الدخول والجلسة (Token في sessionStorage — يُمسح بإغلاق التبويب) */
const Auth = {
  init() {
    // خلفية الدخول اختيارية: تظهر فقط لو الملف موجود، والبطاقة الحقيقية دائمًا فوقها
    const view = document.getElementById('loginView');
    if (APP_CONFIG.LOGIN_BG) {
      const img = new Image();
      img.onload = () => {
        view.style.setProperty('--login-bg', `url("${APP_CONFIG.LOGIN_BG}")`);
        view.classList.add('has-bg');
      };
      img.src = APP_CONFIG.LOGIN_BG;
    }
    document.getElementById('loginForm').addEventListener('submit', e => { e.preventDefault(); this.login(); });
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    Api.onAuthLost = msg => this.showLogin(msg);
  },

  async resume() {
    if (!Api.token) return this.showLogin();
    try {
      const d = await Api.call('auth.me');
      App.enter(d.user);
    } catch (e) {
      if (e.code !== 'SESSION_EXPIRED' && e.code !== 'UNAUTHENTICATED') this.showLogin(e.message);
    }
  },

  async login() {
    const u = document.getElementById('loginUser');
    const p = document.getElementById('loginPass');
    const btn = document.getElementById('loginBtn');
    this.error('');
    if (!u.value.trim() || !p.value) return this.error('اكتب اسم المستخدم وكلمة المرور.');
    UI.busy(btn, true, 'جارٍ الدخول…');
    try {
      const d = await Api.call('auth.login', { username: u.value.trim(), password: p.value });
      Api.setToken(d.token);
      p.value = '';
      App.enter(d.user);
    } catch (e) {
      this.error(e.message);
    } finally {
      UI.busy(btn, false);
    }
  },

  async logout() {
    const btn = document.getElementById('logoutBtn');
    btn.disabled = true;
    try { await Api.call('auth.logout'); } catch (e) { /* الخروج محليًا في كل الأحوال */ }
    btn.disabled = false;
    this.showLogin();
  },

  error(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg || '';
    el.hidden = !msg;
  },

  showLogin(msg) {
    Api.setToken('');
    App.user = null;
    document.getElementById('modalRoot').innerHTML = '';
    document.getElementById('page').innerHTML = '';
    document.getElementById('appView').hidden = true;
    document.getElementById('boot').hidden = true;
    document.getElementById('loginView').hidden = false;
    this.error(msg || '');
    document.getElementById('loginUser').focus();
  }
};
