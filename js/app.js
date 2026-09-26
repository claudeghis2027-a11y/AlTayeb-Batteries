/** التطبيق: القائمة والتنقل. الصلاحيات هنا لإخفاء ما لا يلزم فقط — الحماية الحقيقية في الخادم. */

const NAV = [
  { id: 'home',      label: 'الرئيسية',     perm: 'VIEW_DASHBOARD', page: () => DashboardPage },
  { id: 'items',     label: 'الأصناف',      perm: 'VIEW_ITEMS',     page: ItemsPage },
  { id: 'customers', label: 'العملاء',      perm: 'VIEW_CUSTOMERS', page: CustomersPage },
  { id: 'suppliers', label: 'الموردين',     perm: 'VIEW_SUPPLIERS', page: SuppliersPage },
  { id: 'employees', label: 'الموظفين',     perm: 'VIEW_EMPLOYEES', page: EmployeesPage },
  { id: 'inventory', label: 'المخزون',      perm: 'VIEW_INVENTORY', page: () => InventoryPage },
  { id: 'movements', label: 'حركة المخزون', perm: 'VIEW_INVENTORY', page: () => MovementsPage, hidden: true },
  { id: 'transfers', label: 'إذن نقل / صرف', perm: 'VIEW_TRANSFERS', page: () => TransfersPage },
  { id: 'users',     label: 'المستخدمين',   perm: 'VIEW_USERS',     page: UsersPage },
  { id: 'settings',  label: 'الإعدادات',    perm: 'MANAGE_SETTINGS', page: () => SettingsPage },
  { id: 'audit',     label: 'سجل العمليات', perm: 'VIEW_AUDIT',     page: () => AuditPage }
];

/** نفس قاعدة الخادم للعرض فقط: MANAGE_X تتضمن VIEW_X */
const IMPLIES = {
  MANAGE_ITEMS: ['VIEW_ITEMS'], MANAGE_CUSTOMERS: ['VIEW_CUSTOMERS'], MANAGE_SUPPLIERS: ['VIEW_SUPPLIERS'],
  MANAGE_EMPLOYEES: ['VIEW_EMPLOYEES'], MANAGE_USERS: ['VIEW_USERS'],
  CREATE_TRANSFER: ['VIEW_TRANSFERS'], EDIT_TRANSFER: ['VIEW_TRANSFERS'], POST_TRANSFER: ['VIEW_TRANSFERS'], CANCEL_TRANSFER: ['VIEW_TRANSFERS']
};

const App = {
  user: null,

  can(p) {
    const perms = (this.user && this.user.perms) || [];
    return perms.includes('*') || perms.includes(p) || perms.some(q => (IMPLIES[q] || []).includes(p));
  },

  init() {
    Auth.init();
    window.addEventListener('hashchange', () => { if (this.user) this.route(); });
    Auth.resume();
  },

  enter(user) {
    this.user = user;
    document.getElementById('boot').hidden = true;
    document.getElementById('loginView').hidden = true;
    document.getElementById('appView').hidden = false;
    document.getElementById('whoName').textContent = user.displayName;
    document.getElementById('whoRole').textContent = user.role === 'ADMIN' ? 'مدير' : 'مستخدم';
    document.getElementById('sidebar').innerHTML = NAV.filter(n => !n.hidden && this.can(n.perm)).map(n =>
      `<a class="nav-link" href="#${n.id}" data-nav="${n.id}">${UI.esc(n.label)}</a>`).join('');
    this.route();
  },

  route() {
    // #page أو #page/arg (مثال: #transfers/new ، #transfers/TRF-000001)
    const [id, ...rest] = decodeURIComponent((location.hash || '#home').slice(1)).split('/');
    const arg = rest.join('/');
    const root = document.getElementById('page');
    document.getElementById('modalRoot').innerHTML = '';
    const navId = id === 'movements' ? 'inventory' : id;
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === navId));
    const nav = NAV.find(n => n.id === id) || NAV[0];
    if (!this.can(nav.perm)) {
      root.innerHTML = '<div class="empty err">ليس لديك صلاحية لفتح هذه الصفحة.</div>';
      return;
    }
    root.innerHTML = '';
    nav.page().mount(root, arg);
    root.focus();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
