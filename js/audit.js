/**
 * سجل العمليات — للقراءة فقط.
 * الخادم يرجع صفحة واحدة (200 عملية) من الأحدث للأقدم؛ "تحميل أقدم" يطلب الصفحة التالية.
 * الفلترة محلية على ما تم تحميله.
 */
const AUDIT_ACTION_LABELS = {
  LOGIN_SUCCESS: 'دخول ناجح', LOGIN_FAILURE: 'دخول فاشل', LOGIN_BLOCKED: 'دخول موقوف مؤقتًا', LOGOUT: 'خروج',
  CREATE: 'إضافة', UPDATE: 'تعديل', ACTIVATE: 'تفعيل', DEACTIVATE: 'إيقاف', RESET_PASSWORD: 'تغيير كلمة مرور',
  UPDATE_PERMISSIONS: 'تعديل صلاحيات', PERMISSION_DENIED: 'رفض صلاحية', SETUP_DATABASE: 'تجهيز قاعدة البيانات',
  IMPORT_ITEMS: 'استيراد أصناف'
};
const AUDIT_ENTITY_LABELS = { USER: 'مستخدم', EMPLOYEE: 'موظف', ITEM: 'صنف', CUSTOMER: 'عميل', SUPPLIER: 'مورد', SETTING: 'إعداد', SYSTEM: 'النظام', API: 'عملية' };

const AuditPage = {
  mount(root) {
    const st = { rows: [], page: -1, hasMore: true, action: '', result: '', q: '' };
    root.innerHTML = `
      <div class="page-head"><h2>سجل العمليات</h2></div>
      <div class="toolbar">
        <input type="search" class="search" placeholder="ابحث بالمستخدم أو المعرف أو التفاصيل" aria-label="بحث">
        <select class="select" data-f="action"><option value="">كل العمليات</option>${Object.keys(AUDIT_ACTION_LABELS).map(k =>
          `<option value="${k}">${AUDIT_ACTION_LABELS[k]}</option>`).join('')}</select>
        <select class="select" data-f="result"><option value="">كل النتائج</option><option value="SUCCESS">ناجحة</option><option value="FAILURE">فاشلة</option></select>
        <span class="count" data-ref="count"></span>
      </div>
      <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>
      <div class="pager"><button type="button" class="btn btn-ghost" data-act="more" hidden>تحميل عمليات أقدم</button></div>`;
    const $ = s => root.querySelector(s);
    let t;
    $('.search').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { st.q = UI.norm(e.target.value); render(); }, 150); });
    root.querySelectorAll('[data-f]').forEach(el => el.addEventListener('change', () => { st[el.dataset.f] = el.value; render(); }));
    $('[data-act=more]').addEventListener('click', () => load());

    async function load() {
      const btn = $('[data-act=more]');
      UI.busy(btn, true, 'جارٍ التحميل…');
      try {
        const d = await Api.call('audit.list', { page: st.page + 1 });
        st.page = d.page; st.hasMore = d.hasMore; st.rows = st.rows.concat(d.rows);
        render();
      } catch (e) {
        $('[data-ref=table]').innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`;
      }
      UI.busy(btn, false);
      btn.hidden = !st.hasMore;
    }

    function render() {
      const list = st.rows.filter(r =>
        (!st.action || r.Action === st.action) && (!st.result || r.Result === st.result) &&
        (!st.q || [r.UserName, r.EntityID, r.ReferenceID, r.Details].some(v => UI.norm(v).includes(st.q))));
      $('[data-ref=count]').textContent = `${list.length} من ${st.rows.length} محمّلة`;
      if (!list.length) { $('[data-ref=table]').innerHTML = '<div class="empty">لا توجد عمليات مطابقة.</div>'; return; }
      $('[data-ref=table]').innerHTML = `<table class="audit">
        <thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>النوع</th><th>المعرف</th><th>النتيجة</th><th>التفاصيل</th></tr></thead>
        <tbody>${list.map(r => `<tr class="${r.Result === 'FAILURE' ? 'fail' : ''}">
          <td class="nowrap">${UI.esc(UI.date(r.Timestamp))}</td>
          <td>${UI.esc(r.UserName)}</td>
          <td>${UI.esc(AUDIT_ACTION_LABELS[r.Action] || r.Action)}</td>
          <td>${UI.esc(AUDIT_ENTITY_LABELS[r.EntityType] || r.EntityType || '—')}</td>
          <td class="mono">${UI.esc(r.EntityID || '—')}</td>
          <td>${r.Result === 'FAILURE' ? '<span class="st st-fail">فاشلة</span>' : '<span class="st st-ok">ناجحة</span>'}</td>
          <td><details><summary>عرض</summary><pre>${UI.esc(prettyJson(r.Details))}</pre></details></td>
        </tr>`).join('')}</tbody></table>`;
    }

    function prettyJson(s) {
      try { return JSON.stringify(JSON.parse(s), null, 2); } catch (e) { return String(s || ''); }
    }

    load();
  }
};
