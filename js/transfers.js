/**
 * Phase 2 — إذن نقل / صرف
 * #transfers          القائمة (طلب واحد + فلترة محلية)
 * #transfers/new      إذن جديد
 * #transfers/<ID>     مسودة = قابلة للتعديل حسب الصلاحية، معتمد/ملغي = للقراءة فقط
 * التحقق هنا للراحة فقط — الخادم يعيد التحقق من كل شيء ويحسب الرصيد طازجًا عند الاعتماد.
 */

const TR_STATUS = { DRAFT: 'مسودة', POSTED: 'معتمد', CANCELLED: 'ملغي' };
const trChip = s => `<span class="st st-${UI.esc(String(s).toLowerCase())}">${UI.esc(TR_STATUS[s] || s)}</span>`;

const TransfersPage = {
  mount(page, arg) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    if (!arg) return transfersList(root);
    return transferScreen(root, arg);
  }
};

/* ================= القائمة ================= */

function transfersList(root) {
  const st = { rows: [], f: { no: '', from: '', to: '', status: '', dFrom: '', dTo: '' } };
  root.innerHTML = `
    <div class="page-head"><h2>إذن نقل / صرف</h2>
      <div class="head-actions">
        <button class="btn btn-ghost" data-act="refresh">تحديث</button>
        ${App.can('CREATE_TRANSFER') ? '<a class="btn btn-primary" href="#transfers/new">إذن جديد</a>' : ''}
      </div></div>
    <div class="filters">
      <label>رقم الإذن<input data-f="no" dir="ltr" placeholder="TR-"></label>
      <label>من تاريخ<input data-f="dFrom" type="date"></label>
      <label>إلى تاريخ<input data-f="dTo" type="date"></label>
      <label>من<select data-f="from"><option value="">الكل</option></select></label>
      <label>إلى<select data-f="to"><option value="">الكل</option></select></label>
      <label>الحالة<select data-f="status"><option value="">الكل</option><option value="DRAFT">مسودة</option><option value="POSTED">معتمد</option><option value="CANCELLED">ملغي</option></select></label>
    </div>
    <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;
  const $ = s => root.querySelector(s);
  root.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'INPUT' && el.type !== 'date' ? 'input' : 'change',
    () => { st.f[el.dataset.f] = el.value.trim(); render(); }));
  root.addEventListener('click', e => {
    if (e.target.closest('[data-act=refresh]')) return load();
    const tr = e.target.closest('tr[data-id]');
    if (tr) location.hash = '#transfers/' + tr.dataset.id;
  });
  root.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') location.hash = '#transfers/' + tr.dataset.id; });

  async function load() {
    const btn = $('[data-act=refresh]');
    UI.busy(btn, true, 'جارٍ التحديث…');
    try {
      const d = await Api.call('transfers.list');
      st.rows = d.rows;
      const opts = '<option value="">الكل</option>' + d.locations.map(l => `<option value="${UI.esc(l.LocationID)}">${UI.esc(l.LocationName)}</option>`).join('');
      ['from', 'to'].forEach(k => { const s = $(`[data-f=${k}]`); s.innerHTML = opts; s.value = st.f[k]; });
      render();
    } catch (e) { $('[data-ref=table]').innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; }
    UI.busy(btn, false);
  }

  function render() {
    const f = st.f, no = f.no.toUpperCase();
    const list = st.rows.filter(r => (!no || r.TransferNo.toUpperCase().includes(no)) && (!f.from || r.FromLocationID === f.from) &&
      (!f.to || r.ToLocationID === f.to) && (!f.status || r.Status === f.status) &&
      (!f.dFrom || r.TransferDate >= f.dFrom) && (!f.dTo || r.TransferDate <= f.dTo));
    if (!st.rows.length) { $('[data-ref=table]').innerHTML = '<div class="empty">لا توجد أذون بعد.</div>'; return; }
    if (!list.length) { $('[data-ref=table]').innerHTML = '<div class="empty">لا توجد أذون مطابقة للفلتر.</div>'; return; }
    $('[data-ref=table]').innerHTML = `<table>
      <thead><tr><th>رقم الإذن</th><th>التاريخ</th><th>من</th><th>إلى</th><th>المستلم</th><th class="num">الكمية</th><th>الحالة</th><th>أنشأه</th></tr></thead>
      <tbody>${list.map(r => `<tr class="clickable" data-id="${UI.esc(r.TransferID)}" tabindex="0">
        <td class="mono strong">${UI.esc(r.TransferNo)}</td><td class="mono">${UI.esc(r.TransferDate)}</td>
        <td>${UI.esc(r.FromName)}</td><td>${UI.esc(r.ToName)}</td><td>${UI.esc(r.ReceiverName || '—')}</td>
        <td class="num">${UI.qty(r.TotalQty)} <small class="muted">(${r.LineCount} صنف)</small></td>
        <td>${trChip(r.Status)}</td><td>${UI.esc(r.CreatedByName)}</td></tr>`).join('')}</tbody></table>`;
  }
  load();
}

/* ================= شاشة الإذن ================= */

async function transferScreen(root, id) {
  const isNew = id === 'new';
  const canCreate = App.can('CREATE_TRANSFER'), canEdit = App.can('EDIT_TRANSFER');
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  if (isNew && !canCreate) { root.innerHTML = '<div class="empty err">ليس لديك صلاحية إنشاء إذن نقل.</div>'; return; }

  let meta = null, transfer = null;
  try {
    if ((isNew && canCreate) || (!isNew && canEdit)) {
      meta = await Api.call('transfers.formData', isNew ? {} : { id });   // طلب واحد لكل بيانات الشاشة
      transfer = meta.transfer;
    } else {
      transfer = await Api.call('transfers.get', { id });
    }
  } catch (e) {
    root.innerHTML = `<div class="empty err">${UI.esc(e.message)}<br><a class="btn btn-ghost" href="#transfers">رجوع للقائمة</a></div>`;
    return;
  }
  if (transfer && (transfer.header.Status !== 'DRAFT' || !canEdit)) return renderTransferView(root, transfer);
  renderTransferEditor(root, meta, transfer);
}

function renderTransferView(host, t) {
  const root = document.createElement('div');   // حاوية جديدة في كل رسم — لا تتراكم الـ listeners
  host.replaceChildren(root);
  const h = t.header;
  const canPost = h.Status === 'DRAFT' && App.can('POST_TRANSFER');
  const canCancel = h.Status === 'DRAFT' && App.can('CANCEL_TRANSFER');
  const total = t.lines.reduce((s, l) => s + l.Quantity, 0);
  root.innerHTML = `
    <div class="page-head"><h2>إذن نقل <span class="mono">${UI.esc(h.TransferNo)}</span> ${trChip(h.Status)}</h2>
      <a class="btn btn-ghost" href="#transfers">رجوع للقائمة</a></div>
    <p class="note">${h.Status === 'POSTED' ? 'الإذن معتمد وتم تسجيل حركات المخزون — للقراءة فقط.'
      : h.Status === 'CANCELLED' ? 'الإذن ملغي ولم يُنشئ أي حركة مخزون — للقراءة فقط.' : 'مسودة — لا تؤثر على المخزون.'}</p>
    <div class="doc-grid">
      <div><span>التاريخ</span><b class="mono">${UI.esc(h.TransferDate)}</b></div>
      <div><span>من</span><b>${UI.esc(h.FromName)}</b></div>
      <div><span>إلى</span><b>${UI.esc(h.ToName)}</b></div>
      <div><span>المستلم</span><b>${UI.esc(h.ReceiverName || '—')}</b></div>
      <div><span>أنشأه</span><b>${UI.esc(h.CreatedByName)}</b> <small class="muted">${UI.esc(UI.date(h.CreatedAt))}</small></div>
      ${h.PostedAt ? `<div><span>اعتمده</span><b>${UI.esc(h.PostedByName)}</b> <small class="muted">${UI.esc(UI.date(h.PostedAt))}</small></div>` : ''}
      ${h.CancelledAt ? `<div><span>ألغاه</span><b>${UI.esc(h.CancelledByName)}</b> <small class="muted">${UI.esc(UI.date(h.CancelledAt))}</small></div>` : ''}
      ${h.Notes ? `<div class="wide"><span>ملاحظات</span><b>${UI.esc(h.Notes)}</b></div>` : ''}
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>الكود</th><th>البطارية</th><th class="num">الكمية</th><th>ملاحظات</th></tr></thead>
      <tbody>${t.lines.map(l => `<tr><td class="mono">${UI.esc(l.ItemCode)}</td><td>${UI.esc(l.ItemName)}</td><td class="num">${UI.qty(l.Quantity)}</td><td>${UI.esc(l.Notes || '')}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td></td><td>الإجمالي</td><td class="num">${UI.qty(total)}</td><td></td></tr></tfoot></table></div>
    <p class="form-error" data-ref="err" hidden></p>
    ${canPost || canCancel ? `<div class="doc-actions">
      ${canPost ? '<button class="btn btn-primary" data-act="post">اعتماد الإذن</button>' : ''}
      ${canCancel ? '<button class="btn btn-danger" data-act="cancel">إلغاء الإذن</button>' : ''}</div>` : ''}`;
  root.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const err = root.querySelector('[data-ref=err]');
    err.hidden = true;
    try {
      const r = b.dataset.act === 'post' ? await doPost(h, b) : await doCancel(h, b);
      if (r) renderTransferView(host, r);
    } catch (x) { err.textContent = x.message; err.hidden = false; }
  };
}

async function doPost(h, btn) {
  if (!await UI.confirm(`اعتماد الإذن ${h.TransferNo}؟ سيتم نقل الكميات فورًا ولن يمكن تعديله أو إلغاؤه بعد ذلك.`, 'اعتماد الإذن')) return null;
  UI.busy(btn, true, 'جارٍ الاعتماد…');
  try {
    const r = await Api.call('transfers.post', { id: h.TransferID }, { requestId: 'post-' + h.TransferID });
    UI.toast(`تم اعتماد الإذن ${r.header.TransferNo}.`);
    return r;
  } finally { if (btn.isConnected) UI.busy(btn, false); }
}

async function doCancel(h, btn) {
  if (!await UI.confirm(`إلغاء الإذن ${h.TransferNo}؟ سيبقى محفوظًا كإذن ملغي ولا يمكن اعتماده بعد ذلك.`, 'إلغاء الإذن', true)) return null;
  UI.busy(btn, true, 'جارٍ الإلغاء…');
  try {
    const r = await Api.call('transfers.cancel', { id: h.TransferID }, { requestId: 'cancel-' + h.TransferID });
    UI.toast('تم إلغاء الإذن.');
    return r;
  } finally { if (btn.isConnected) UI.busy(btn, false); }
}

function renderTransferEditor(host, meta, transfer, errMsg) {
  const root = document.createElement('div');   // حاوية جديدة في كل رسم — لا تتراكم الـ listeners
  host.replaceChildren(root);
  const h = transfer ? transfer.header : null;
  const canPost = App.can('POST_TRANSFER'), canCancel = App.can('CANCEL_TRANSFER');
  const itemById = {}, idByLabel = {};
  const label = i => `${i.ItemCode} — ${i.ItemName}`;
  meta.items.forEach(i => { itemById[i.ItemID] = i; idByLabel[label(i)] = i.ItemID; });
  const st = {
    id: h ? h.TransferID : '',
    lines: transfer ? transfer.lines.map(l => ({ ItemID: l.ItemID, Quantity: String(l.Quantity), Notes: l.Notes || '', _text: label(l) }))
                    : [{ ItemID: '', Quantity: '', Notes: '' }],
    saveReq: Api.newRequestId()
  };
  const locOpts = sel => '<option value="">— اختر —</option>' + meta.locations.map(l =>
    `<option value="${UI.esc(l.LocationID)}"${l.LocationID === sel ? ' selected' : ''}>${UI.esc(l.LocationName)}</option>`).join('');
  const empOpts = sel => '<option value="">— بدون —</option>' + meta.employees.map(e =>
    `<option value="${UI.esc(e.EmployeeID)}"${e.EmployeeID === sel ? ' selected' : ''}>${UI.esc(e.EmployeeName)}</option>`).join('');

  root.innerHTML = `
    <div class="page-head"><h2>${h ? `إذن نقل <span class="mono">${UI.esc(h.TransferNo)}</span> ${trChip('DRAFT')}` : 'إذن نقل / صرف جديد'}</h2>
      <a class="btn btn-ghost" href="#transfers">رجوع للقائمة</a></div>
    <datalist id="trItems">${meta.items.map(i => `<option value="${UI.esc(label(i))}"></option>`).join('')}</datalist>
    <div class="doc-form">
      <label class="field"><span>رقم الإذن</span><div class="ro mono">${h ? UI.esc(h.TransferNo) : 'يُولد من الخادم عند الحفظ'}</div></label>
      <label class="field"><span>التاريخ <span class="req">*</span></span><input type="date" name="TransferDate" value="${UI.esc(h ? h.TransferDate : UI.today())}"></label>
      <label class="field"><span>من <span class="req">*</span></span><select name="FromLocationID">${locOpts(h ? h.FromLocationID : '')}</select></label>
      <label class="field"><span>إلى <span class="req">*</span></span><select name="ToLocationID">${locOpts(h ? h.ToLocationID : '')}</select></label>
      <label class="field"><span>المستلم (اختياري)</span><select name="ReceivedByEmployeeID">${empOpts(h ? h.ReceivedByEmployeeID : '')}</select></label>
      <label class="field wide"><span>ملاحظات</span><input name="Notes" maxlength="500" value="${UI.esc(h ? h.Notes : '')}"></label>
    </div>
    <p class="form-error" data-ref="locErr" hidden></p>
    <div class="table-wrap"><table class="lines">
      <thead><tr><th style="width:42%">البطارية</th><th class="num" style="width:12%">الكمية</th><th class="num" style="width:14%">المتاح في المصدر</th><th>ملاحظات السطر</th><th></th></tr></thead>
      <tbody data-ref="lines"></tbody>
      <tfoot><tr><td><button type="button" class="btn btn-ghost btn-sm" data-act="addLine">إضافة صنف</button></td><td class="num" data-ref="sum"></td><td colspan="3"></td></tr></tfoot>
    </table></div>
    <p class="hint-line">الرصيد المتاح للعرض فقط — الاعتماد يحسب الرصيد من جديد في الخادم.</p>
    <p class="form-error" data-ref="err" hidden></p>
    <div class="doc-actions">
      <button type="button" class="btn btn-blue" data-act="save">حفظ مسودة</button>
      ${canPost ? '<button type="button" class="btn btn-primary" data-act="post">اعتماد الإذن</button>' : ''}
      ${h && canCancel ? '<button type="button" class="btn btn-danger" data-act="cancel">إلغاء الإذن</button>' : ''}
    </div>`;

  const $ = s => root.querySelector(s);
  const from = () => $('[name=FromLocationID]').value, to = () => $('[name=ToLocationID]').value;
  const avail = itemId => (itemId && from()) ? ((meta.balances[itemId] || {})[from()] || 0) : null;
  const toInt = v => { const s = String(v).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).trim(); return /^\d+$/.test(s) ? Number(s) : NaN; };

  function renderLines() {
    $('[data-ref=lines]').innerHTML = st.lines.map((l, i) => `
      <tr data-i="${i}">
        <td><input class="cell" list="trItems" data-k="item" value="${UI.esc(l.ItemID ? label(itemById[l.ItemID] || l) : (l._text || ''))}" placeholder="اكتب اسم البطارية أو الكود"></td>
        <td class="num"><input class="cell num-in" data-k="qty" inputmode="numeric" dir="ltr" value="${UI.esc(l.Quantity)}"></td>
        <td class="num" data-ref="avail"></td>
        <td><input class="cell" data-k="notes" maxlength="200" value="${UI.esc(l.Notes)}"></td>
        <td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="rm">حذف</button></td>
      </tr><tr class="line-msg" data-msg="${i}" hidden><td colspan="5"></td></tr>`).join('');
    validate();
  }

  /** تحقق فوري بدون طلب للخادم. يرجع { problems, stockProblems } */
  function validate() {
    let problems = 0, stockProblems = 0;
    const le = $('[data-ref=locErr]');
    if (from() && from() === to()) { le.textContent = 'لا يمكن النقل من المكان إلى نفسه.'; le.hidden = false; problems++; } else le.hidden = true;
    const seen = {}; let sum = 0;
    st.lines.forEach((l, i) => {
      const tr = $(`tr[data-i="${i}"]`), msgRow = $(`tr[data-msg="${i}"]`);
      const a = avail(l.ItemID), q = toInt(l.Quantity);
      tr.querySelector('[data-ref=avail]').textContent = a === null ? '—' : UI.qty(a);
      let msg = '';
      if (l._text && !l.ItemID) msg = 'اختر البطارية من القائمة.';
      else if (l.ItemID && seen[l.ItemID]) msg = 'الصنف مكرر في الإذن. اجمع الكمية في سطر واحد.';
      else if (l.ItemID && l.Quantity !== '' && !(q > 0)) msg = 'الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.';
      else if (l.ItemID && q > 0 && a !== null && q > a) { msg = 'الكمية المطلوبة أكبر من الرصيد المتاح.'; stockProblems++; }
      if (l.ItemID) seen[l.ItemID] = true;
      if (q > 0) sum += q;
      tr.classList.toggle('bad', !!msg); msgRow.hidden = !msg; msgRow.firstElementChild.textContent = msg;
      if (msg) problems++;
    });
    $('[data-ref=sum]').textContent = sum ? 'الإجمالي: ' + UI.qty(sum) : '';
    return { problems, stockProblems };
  }

  root.addEventListener('input', e => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    const l = st.lines[Number(tr.dataset.i)], k = e.target.dataset.k, v = e.target.value;
    if (k === 'item') { l._text = v.trim(); l.ItemID = idByLabel[l._text] || ''; }
    else if (k === 'qty') l.Quantity = v.trim();
    else if (k === 'notes') l.Notes = v;
    validate();
  });
  root.addEventListener('change', e => { if (/LocationID$/.test(e.target.name)) validate(); });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'addLine') { st.lines.push({ ItemID: '', Quantity: '', Notes: '' }); renderLines(); const ins = root.querySelectorAll('[data-k=item]'); ins[ins.length - 1].focus(); }
    else if (act === 'rm') { st.lines.splice(Number(b.closest('tr').dataset.i), 1); if (!st.lines.length) st.lines.push({ ItemID: '', Quantity: '', Notes: '' }); renderLines(); }
    else if (act === 'save') save(false, b);
    else if (act === 'post') save(true, b);
    else if (act === 'cancel') cancel(b);
  });

  const showErr = m => { const el = $('[data-ref=err]'); el.textContent = m || ''; el.hidden = !m; };
  const lock = on => root.querySelectorAll('.doc-actions .btn').forEach(x => { x.disabled = on; });

  async function save(andPost, btn) {
    showErr('');
    if (!from() || !to()) return showErr('اختر المصدر (من) والوجهة (إلى).');
    const lines = st.lines.filter(l => l.ItemID || l.Quantity !== '' || l._text);
    if (!lines.length) return showErr('أضف صنفًا واحدًا على الأقل.');
    const v = validate();
    if (v.problems - v.stockProblems > 0) return showErr('صحّح الأخطاء الموضحة قبل الحفظ.');
    if (andPost && v.stockProblems) return showErr('الكمية المطلوبة أكبر من الرصيد المتاح في بعض السطور — لا يمكن الاعتماد.');
    if (andPost && !await UI.confirm('حفظ واعتماد الإذن؟ سيتم نقل الكميات فورًا ولن يمكن تعديله أو إلغاؤه بعد ذلك.', 'اعتماد الإذن')) return;

    const payload = {
      TransferID: st.id, TransferDate: $('[name=TransferDate]').value, FromLocationID: from(), ToLocationID: to(),
      ReceivedByEmployeeID: $('[name=ReceivedByEmployeeID]').value, Notes: $('[name=Notes]').value.trim(),
      lines: lines.map(l => ({ ItemID: l.ItemID, Quantity: l.Quantity, Notes: l.Notes }))
    };
    lock(true); UI.busy(btn, true, andPost ? 'جارٍ الاعتماد…' : 'جارٍ الحفظ…');
    const firstSave = !st.id;
    let saved = null;
    try {
      saved = await Api.call(firstSave ? 'transfers.saveDraft' : 'transfers.updateDraft', payload, { requestId: st.saveReq });
      st.id = saved.header.TransferID; st.saveReq = Api.newRequestId();
      if (firstSave) history.replaceState(null, '', '#transfers/' + st.id);
      if (!andPost) { UI.toast(`تم حفظ المسودة ${saved.header.TransferNo}.`); return renderTransferEditor(host, meta, saved); }
      const posted = await Api.call('transfers.post', { id: st.id }, { requestId: 'post-' + st.id });
      UI.toast(`تم اعتماد الإذن ${posted.header.TransferNo}.`);
      renderTransferView(host, posted);
    } catch (e) {
      if (e.code === 'INSUFFICIENT_STOCK' && st.id) {
        // الرصيد تغيّر: نعيد تحميل الأرصدة الحالية (طلب واحد) ونعرض المسودة المحفوظة مع سبب الرفض
        try { const fresh = await Api.call('transfers.formData', { id: st.id }); return renderTransferEditor(host, fresh, fresh.transfer, e.message); }
        catch (x) { /* نكمل بالبيانات الحالية */ }
      }
      if (saved) return renderTransferEditor(host, meta, saved, e.message);   // المسودة اتحفظت والاعتماد رُفض
      lock(false); UI.busy(btn, false); showErr(e.message);
    }
  }

  async function cancel(btn) {
    lock(true);
    try {
      const r = await doCancel(h, btn);
      if (r) return renderTransferView(host, r);
    } catch (e) { showErr(e.message); }
    lock(false);
  }

  renderLines();
  if (errMsg) showErr(errMsg);
}
