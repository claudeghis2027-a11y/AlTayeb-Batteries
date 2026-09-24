/** المستخدمين — حسابات الدخول (منفصلة عن الموظفين، والربط بموظف اختياري) */
const UsersPage = () => createCrudPage({
  title: 'المستخدمين', addLabel: 'إضافة مستخدم', editTitle: 'تعديل مستخدم',
  listAction: 'users.list', saveAction: 'users.save', setActiveAction: 'users.setActive',
  managePerm: 'MANAGE_USERS', idField: 'UserID', nameField: 'Username',
  searchPlaceholder: 'ابحث باسم المستخدم أو الاسم', searchKeys: ['Username', 'DisplayName', 'EmployeeName'],
  columns: [
    { key: 'Username', label: 'اسم المستخدم', cls: 'mono' },
    { key: 'DisplayName', label: 'الاسم الظاهر' },
    { label: 'الدور', render: r => r.Role === 'ADMIN' ? 'مدير' : 'مستخدم' },
    { label: 'الموظف المرتبط', render: r => UI.esc(r.EmployeeName || '—') },
    { label: 'آخر دخول', render: r => UI.esc(UI.date(r.LastLoginAt)) }
  ],
  isProtected: r => r.UserID === App.user.userId, // لا يوقف نفسه (والخادم يرفض أيضًا)
  extraActions: [{ act: 'reset', label: 'كلمة المرور', run: openResetPassword }],
  form: (meta, row) => {
    const emps = (meta.employees || []).filter(e => e.Active || (row && e.EmployeeID === row.EmployeeID));
    const base = (meta.rolePermissions || {}).USER || [];
    return [
      { key: 'Username', label: 'اسم المستخدم', required: true, ltr: true, max: 30, hint: 'حروف إنجليزية وأرقام بدون مسافات.' },
      { key: 'DisplayName', label: 'الاسم الظاهر', required: true, max: 80 },
      { key: 'Role', label: 'الدور', type: 'select', default: 'USER',
        options: [{ value: 'USER', label: 'مستخدم' }, { value: 'ADMIN', label: 'مدير (كل الصلاحيات)' }] },
      { key: 'Permissions', label: 'صلاحيات المستخدم', type: 'checks', default: [],
        hint: 'الدخول والرئيسية متاحان لكل مستخدم. "إدارة" تشمل "العرض".',
        options: (meta.permissions || []).filter(p => !base.includes(p.key)).map(p => ({ value: p.key, label: p.label })) },
      { key: 'EmployeeID', label: 'الموظف المرتبط (اختياري)', type: 'select',
        options: [{ value: '', label: '— بدون —' }].concat(emps.map(e => ({ value: e.EmployeeID, label: e.EmployeeName }))) },
      ...(row ? [] : [{ key: 'Password', label: 'كلمة المرور', type: 'password', required: true, ltr: true, max: 64, hint: '6 أحرف على الأقل.' }])
    ];
  },
  // الصلاحيات الإضافية لا معنى لها مع دور المدير
  onFormMount(form) {
    const role = form.elements.Role;
    const box = form.querySelector('[data-key=Permissions]');
    const sync = () => { box.hidden = role.value === 'ADMIN'; };
    role.addEventListener('change', sync);
    sync();
  }
});

function openResetPassword(user) {
  const requestId = Api.newRequestId();
  const m = UI.modal({
    title: 'تغيير كلمة المرور — ' + user.Username,
    body: `
      <label class="field"><span>كلمة المرور الجديدة <span class="req">*</span></span>
        <input name="p1" type="password" dir="ltr" autocomplete="new-password" maxlength="64"></label>
      <label class="field"><span>تأكيد كلمة المرور <span class="req">*</span></span>
        <input name="p2" type="password" dir="ltr" autocomplete="new-password" maxlength="64">
        <small class="hint">سيتم إنهاء أي جلسة مفتوحة لهذا المستخدم.</small></label>`,
    foot: `<button type="submit" class="btn btn-primary">حفظ كلمة المرور</button>
           <button type="button" class="btn btn-ghost" data-close>إلغاء</button>`
  });
  m.form.addEventListener('submit', async e => {
    e.preventDefault();
    const p1 = m.form.elements.p1.value, p2 = m.form.elements.p2.value;
    if (p1.length < 6) return m.error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
    if (p1 !== p2) return m.error('كلمتا المرور غير متطابقتين.');
    const btn = m.form.querySelector('[type=submit]');
    UI.busy(btn, true);
    try {
      await Api.call('users.resetPassword', { id: user.UserID, newPassword: p1 }, { requestId });
      m.close();
      UI.toast('تم تغيير كلمة المرور.');
    } catch (x) { UI.busy(btn, false); m.error(x.message); }
  });
}
