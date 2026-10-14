/**
 * Phase 3 — أرصدة أول المدة
 * #opening          قائمة العمليات
 * #opening/new      عملية جديدة
 * #opening/<ID>     مسودة = قابلة للتعديل (MANAGE_OPENING) ، معتمدة/ملغاة = للقراءة فقط
 * التحقق هنا للراحة فقط — الخادم يعيد التحقق ويمنع التكرار داخل الـ Lock.
 */

const OB_STATUS = { DRAFT: 'مسودة', POSTED: 'معتمدة', CANCELLED: 'ملغاة' };
const obChip = s => `<span class="st st-${UI.esc(String(s).toLowerCase())}">${UI.esc(OB_STATUS[s] || s)}</span>`;
const money = n => UI.money(n === '' || n == null ? '' : Number(n));

const OpeningPage = {
  mount(page, arg) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    return arg ? openingScreen(root, arg) : openingList(root);
  }
};

/* ================= القائمة ================= */

async function openingList(root) {
  root.innerHTML = `
    <div class="page-head"><h2>أرصدة أول المدة</h2>
      <div class="head-actions">
        ${App.can('RESOLVE_COST') ? '<a class="btn btn-ghost" href="#costs">تكاليف غير معروفة</a>' : ''}
        ${App.can('MANAGE_OPENING') ? '<a class="btn btn-primary" href="#opening/new">عملية جديدة</a>' : ''}</div></div>
    <p class="note">تسجيل الأرصدة الفعلية عند بدء التشغيل: المخزون في الأماكن الأربعة، والمستحق لنا على العملاء، والمستحق علينا للموردين. بعد الاعتماد لا يمكن التعديل.</p>
    <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;
  let d;
  try { d = await Api.call('opening.list'); }
  catch (e) { root.querySelector('[data-ref=table]').innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }
  const box = root.querySelector('[data-ref=table]');
  if (!d.rows.length) { box.innerHTML = '<div class="empty">لم تُسجل أي أرصدة افتتاحية بعد.</div>'; return; }
  box.innerHTML = `<table>
    <thead><tr><th>الرقم</th><th>التاريخ</th><th>الحالة</th><th class="num">كمية المخزون</th><th class="num">مستحق على العملاء</th><th class="num">مستحق للموردين</th><th>أنشأها</th></tr></thead>
    <tbody>${d.rows.map(r => `<tr class="clickable" data-id="${UI.esc(r.OpeningID)}" tabindex="0">
      <td class="mono strong">${UI.esc(r.OpeningNo)}</td><td class="mono">${UI.esc(r.OpeningDate)}</td><td>${obChip(r.Status)}</td>
      <td class="num">${UI.qty(r.totals.stockQty)}</td><td class="num">${money(r.totals.customersTotal)}</td><td class="num">${money(r.totals.suppliersTotal)}</td>
      <td>${UI.esc(r.CreatedByName)}</td></tr>`).join('')}</tbody></table>`;
  box.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#opening/' + tr.dataset.id; });
  box.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') location.hash = '#opening/' + tr.dataset.id; });
}

/* ================= الشاشة ================= */

async function openingScreen(root, id) {
  const isNew = id === 'new', canManage = App.can('MANAGE_OPENING');
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  if (isNew && !canManage) { root.innerHTML = '<div class="empty err">ليس لديك صلاحية إدخال أرصدة أول المدة.</div>'; return; }
  let meta = null, op = null;
  try {
    if (canManage) { meta = await Api.call('opening.formData', isNew ? {} : { id }); op = meta.opening; }   // طلب واحد
    else op = await Api.call('opening.get', { id });
  } catch (e) {
    root.innerHTML = `<div class="empty err">${UI.esc(e.message)}<br><a class="btn btn-ghost" href="#opening">رجوع</a></div>`; return;
  }
  if (op && (op.header.Status !== 'DRAFT' || !canManage)) return renderOpeningView(root, op);
  renderOpeningEditor(root, meta, op);
}

function totalsHtml(t, locNames) {
  const byLoc = Object.keys(t.stockQtyByLocation || {}).map(k => `${UI.esc(locNames[k] || k)}: <b>${UI.qty(t.stockQtyByLocation[k])}</b>`).join(' · ');
  return `<div class="ob-totals">
    <div><span>المخزون</span><b>${UI.qty(t.stockQty)}</b><small>${t.stockLines} سطر${byLoc ? ' — ' + byLoc : ''}</small></div>
    <div><span>قيمة المخزون (المعروفة تكلفته)</span><b>${money(t.stockValueKnown)}</b>
      <small>${t.stockQtyWithoutCost ? `<span class="warn">${UI.qty(t.stockQtyWithoutCost)} قطعة بدون تكلفة (${t.itemsWithoutCost} صنف)</span>` : 'كل الأصناف لها تكلفة'}</small></div>
    <div><span>مستحق لنا على العملاء</span><b>${money(t.customersTotal)}</b><small>${t.customers} عميل</small></div>
    <div><span>مستحق علينا للموردين</span><b>${money(t.suppliersTotal)}</b><small>${t.suppliers} مورد</small></div>
  </div>`;
}

function detailTables(op) {
  const stock = op.stockLines.length ? `<h4 class="sub-head">المخزون الافتتاحي</h4><div class="table-wrap"><table>
    <thead><tr><th>الكود</th><th>الصنف</th><th>المكان</th><th class="num">الكمية</th><th class="num">التكلفة للقطعة</th><th>ملاحظات</th></tr></thead>
    <tbody>${op.stockLines.map(l => `<tr><td class="mono">${UI.esc(l.ItemCode)}</td><td>${UI.esc(l.ItemName)}</td><td>${UI.esc(l.LocationName)}</td>
      <td class="num">${UI.qty(l.Quantity)}</td><td class="num">${l.UnitCost === '' ? '<span class="muted">غير محددة</span>' : money(l.UnitCost)}</td><td>${UI.esc(l.Notes || '')}</td></tr>`).join('')}</tbody></table></div>` : '';
  const party = (rows, title) => rows.length ? `<h4 class="sub-head">${title}</h4><div class="table-wrap"><table>
    <thead><tr><th>الكود</th><th>الاسم</th><th class="num">المبلغ</th><th>ملاحظات</th></tr></thead>
    <tbody>${rows.map(l => `<tr><td class="mono">${UI.esc(l.PartyCode)}</td><td>${UI.esc(l.PartyName)}</td><td class="num">${money(l.Amount)}</td><td>${UI.esc(l.Notes || '')}</td></tr>`).join('')}</tbody></table></div>` : '';
  return stock + party(op.customerLines, 'أرصدة العملاء (مستحق لنا)') + party(op.supplierLines, 'أرصدة الموردين (مستحق علينا)');
}

/** أسماء الأماكن من بيانات العملية نفسها (القادمة من الخادم) */
const locNamesOf = op => { const m = {}; op.stockLines.forEach(l => { m[l.LocationID] = l.LocationName; }); return m; };

function renderOpeningView(host, op) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const h = op.header;
  const canPost = h.Status === 'DRAFT' && App.can('POST_OPENING');
  root.innerHTML = `
    <div class="page-head"><h2>أرصدة أول المدة <span class="mono">${UI.esc(h.OpeningNo)}</span> ${obChip(h.Status)}</h2>
      <a class="btn btn-ghost" href="#opening">رجوع للقائمة</a></div>
    <p class="note">${h.Status === 'POSTED' ? 'معتمدة — للقراءة فقط. أي تصحيح لاحق يكون بحركة عكسية أو تسوية موثقة.'
      : h.Status === 'CANCELLED' ? 'ملغاة — لم تُنشئ أي حركة أو قيد.' : 'مسودة — لا تؤثر على المخزون أو الأرصدة.'}</p>
    <div class="doc-grid">
      <div><span>تاريخ الأرصدة</span><b class="mono">${UI.esc(h.OpeningDate)}</b></div>
      <div><span>أنشأها</span><b>${UI.esc(h.CreatedByName)}</b> <small class="muted">${UI.esc(UI.date(h.CreatedAt))}</small></div>
      ${h.PostedAt ? `<div><span>اعتمدها</span><b>${UI.esc(h.PostedByName)}</b> <small class="muted">${UI.esc(UI.date(h.PostedAt))}</small></div>` : ''}
      ${h.CancelledAt ? `<div><span>ألغاها</span><b>${UI.esc(h.CancelledByName)}</b> <small class="muted">${UI.esc(UI.date(h.CancelledAt))}</small></div>` : ''}
      ${h.Notes ? `<div class="wide"><span>ملاحظات</span><b>${UI.esc(h.Notes)}</b></div>` : ''}
    </div>
    ${totalsHtml(op.totals, locNamesOf(op))}
    ${detailTables(op)}
    <p class="form-error" data-ref="err" hidden></p>
    ${canPost ? '<div class="doc-actions"><button class="btn btn-primary" data-act="post">معاينة واعتماد</button></div>' : ''}
    ${h.Status === 'POSTED' ? `<h4 class="sub-head">التسويات على هذه العملية</h4>
      ${App.can('MANAGE_OPENING') ? `<p><a class="btn btn-ghost" href="#adjust/new/${UI.esc(h.OpeningID)}">تسوية جديدة (OA)</a></p>` : ''}
      <div data-ref="adjs"><div class="loading">جارٍ التحميل…</div></div>` : ''}`;
  if (h.Status === 'POSTED') loadOpeningAdjustments(root.querySelector('[data-ref=adjs]'), h.OpeningID);
  const btn = root.querySelector('[data-act=post]');
  if (btn) btn.addEventListener('click', async () => {
    const r = await previewAndPost(op, btn, root.querySelector('[data-ref=err]'));
    if (r) renderOpeningView(host, r);
  });
}

/** التسويات المرتبطة بعملية معتمدة — طلب واحد */
async function loadOpeningAdjustments(box, openingId) {
  try {
    const d = await Api.call('adjust.list', { openingId });
    box.innerHTML = d.rows.length ? `<div class="table-wrap"><table><thead><tr><th>الرقم</th><th>التاريخ</th><th>السبب</th><th>الحالة</th></tr></thead>
      <tbody>${d.rows.map(r => `<tr class="clickable" onclick="location.hash='#adjust/${UI.esc(r.AdjustmentID)}'"><td class="mono">${UI.esc(r.AdjustmentNo)}</td>
        <td class="mono">${UI.esc(r.AdjustmentDate)}</td><td>${UI.esc(r.Reason)}</td><td>${obChip(r.Status)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">لا توجد تسويات.</div>';
  } catch (e) { box.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; }
}

/** معاينة الإجماليات والتفاصيل كما هي محفوظة في الخادم ثم الاعتماد النهائي */
function previewAndPost(op, btn, errEl) {
  return new Promise(resolve => {
    const m = UI.modal({
      title: 'معاينة قبل الاعتماد — ' + op.header.OpeningNo, wide: true,
      body: `<p class="note">تاريخ الأرصدة: <b class="mono">${UI.esc(op.header.OpeningDate)}</b>. بعد الاعتماد لا يمكن التعديل أو الحذف.</p>
        ${totalsHtml(op.totals, locNamesOf(op))}
        ${op.totals.stockQtyWithoutCost ? '<p class="notice">بعض الأصناف بدون تكلفة افتتاحية. لن يُفترض لها أي تكلفة: ستُسجل حالتها "تكلفة غير معروفة" ويُترك متوسط تكلفتها فارغًا (وليس صفرًا) لحين تحديدها.</p>' : ''}
        <details class="preview-details"><summary>عرض التفاصيل</summary>${detailTables(op)}</details>`,
      foot: `<button type="submit" class="btn btn-primary">اعتماد نهائي</button><button type="button" class="btn btn-ghost" data-close>رجوع</button>`
    });
    let settled = false;
    const obs = new MutationObserver(() => { if (!m.root.isConnected) { obs.disconnect(); if (!settled) resolve(null); } });
    obs.observe(document.getElementById('modalRoot'), { childList: true });
    m.form.addEventListener('submit', async e => {
      e.preventDefault();
      const sb = m.form.querySelector('[type=submit]');
      UI.busy(sb, true, 'جارٍ الاعتماد…');
      try {
        const r = await Api.call('opening.post', { id: op.header.OpeningID }, { requestId: 'post-' + op.header.OpeningID });
        settled = true; m.close(); UI.toast(`تم اعتماد ${r.header.OpeningNo}.`); resolve(r);
      } catch (x) {
        UI.busy(sb, false); m.error(x.message);
        if (errEl) { errEl.textContent = x.message; errEl.hidden = false; }
      }
    });
  });
}

/* ================= المحرر ================= */

function renderOpeningEditor(host, meta, op, errMsg) {
  const root = document.createElement('div');   // حاوية جديدة كل رسم — لا تتراكم الـ listeners
  host.replaceChildren(root);
  const h = op ? op.header : null;
  const canPost = App.can('POST_OPENING');
  const itemLabel = i => `${i.ItemCode} — ${i.ItemName}`;
  const partyLabel = p => `${p.Code} — ${p.Name}`;
  const itemByLabel = {}, custByLabel = {}, suppByLabel = {}, itemById = {}, custById = {}, suppById = {};
  meta.items.forEach(i => { itemByLabel[itemLabel(i)] = i.ItemID; itemById[i.ItemID] = i; });
  meta.customers.forEach(p => { custByLabel[partyLabel(p)] = p.PartyID; custById[p.PartyID] = p; });
  meta.suppliers.forEach(p => { suppByLabel[partyLabel(p)] = p.PartyID; suppById[p.PartyID] = p; });
  const locNames = {}; meta.locations.forEach(l => { locNames[l.LocationID] = l.LocationName; });

  const st = {
    tab: 'stock', saveReq: Api.newRequestId(), id: h ? h.OpeningID : '',
    stock: op ? op.stockLines.map(l => ({ ItemID: l.ItemID, _text: itemById[l.ItemID] ? itemLabel(itemById[l.ItemID]) : l.ItemName, LocationID: l.LocationID,
      Quantity: String(l.Quantity), UnitCost: l.UnitCost === '' ? '' : String(l.UnitCost), Notes: l.Notes || '' })) : [],
    customer: op ? op.customerLines.map(l => ({ PartyID: l.PartyID, _text: custById[l.PartyID] ? partyLabel(custById[l.PartyID]) : l.PartyName, Amount: String(l.Amount), Notes: l.Notes || '' })) : [],
    supplier: op ? op.supplierLines.map(l => ({ PartyID: l.PartyID, _text: suppById[l.PartyID] ? partyLabel(suppById[l.PartyID]) : l.PartyName, Amount: String(l.Amount), Notes: l.Notes || '' })) : []
  };
  if (!st.stock.length) st.stock.push({ ItemID: '', LocationID: '', Quantity: '', UnitCost: '', Notes: '' });

  root.innerHTML = `
    <div class="page-head"><h2>${h ? `أرصدة أول المدة <span class="mono">${UI.esc(h.OpeningNo)}</span> ${obChip('DRAFT')}` : 'أرصدة أول المدة — عملية جديدة'}</h2>
      <a class="btn btn-ghost" href="#opening">رجوع للقائمة</a></div>
    <datalist id="obItems">${meta.items.map(i => `<option value="${UI.esc(itemLabel(i))}"></option>`).join('')}</datalist>
    <datalist id="obCustomers">${meta.customers.map(p => `<option value="${UI.esc(partyLabel(p))}"></option>`).join('')}</datalist>
    <datalist id="obSuppliers">${meta.suppliers.map(p => `<option value="${UI.esc(partyLabel(p))}"></option>`).join('')}</datalist>
    <div class="doc-form ob-head">
      <label class="field"><span>الرقم</span><div class="ro mono">${h ? UI.esc(h.OpeningNo) : 'يُولد من الخادم عند الحفظ'}</div></label>
      <label class="field"><span>تاريخ الأرصدة <span class="req">*</span></span><input type="date" name="OpeningDate" value="${UI.esc(h ? h.OpeningDate : UI.today())}"></label>
      <label class="field wide3"><span>ملاحظات</span><input name="Notes" maxlength="500" value="${UI.esc(h ? h.Notes : '')}"></label>
    </div>
    <div class="tabs" role="tablist">
      <button type="button" data-tab="stock" class="on">المخزون الافتتاحي <span data-count="stock"></span></button>
      <button type="button" data-tab="customer">أرصدة العملاء <span data-count="customer"></span></button>
      <button type="button" data-tab="supplier">أرصدة الموردين <span data-count="supplier"></span></button>
    </div>
    <div class="table-wrap" data-ref="section"></div>
    <div data-ref="totals"></div>
    <p class="form-error" data-ref="err" hidden></p>
    <div class="doc-actions">
      <button type="button" class="btn btn-blue" data-act="save">حفظ مسودة</button>
      ${canPost ? '<button type="button" class="btn btn-primary" data-act="post">حفظ ومعاينة للاعتماد</button>' : ''}
      ${h ? '<button type="button" class="btn btn-danger" data-act="cancel">إلغاء المسودة</button>' : ''}
    </div>`;
  const $ = s => root.querySelector(s);
  const digits = v => String(v).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[,٬\s]/g, '').trim();
  const isInt = v => /^\d+$/.test(digits(v)) && Number(digits(v)) > 0;
  const isPos = v => /^\d+(\.\d+)?$/.test(digits(v)) && Number(digits(v)) > 0;

  function sectionHtml() {
    if (st.tab === 'stock') {
      return `<table class="lines"><thead><tr><th style="width:36%">الصنف</th><th style="width:16%">المكان</th><th class="num" style="width:10%">الكمية</th>
        <th class="num" style="width:13%">التكلفة للقطعة (اختياري)</th><th>ملاحظات</th><th></th></tr></thead><tbody>
        ${st.stock.map((l, i) => `<tr data-i="${i}">
          <td><input class="cell" list="obItems" data-k="item" value="${UI.esc(l._text || '')}" placeholder="اكتب اسم الصنف أو الكود"></td>
          <td><select class="cell" data-k="loc"><option value="">— اختر —</option>${meta.locations.map(x => `<option value="${UI.esc(x.LocationID)}"${x.LocationID === l.LocationID ? ' selected' : ''}>${UI.esc(x.LocationName)}</option>`).join('')}</select></td>
          <td class="num"><input class="cell num-in" data-k="qty" inputmode="numeric" dir="ltr" value="${UI.esc(l.Quantity)}"></td>
          <td class="num"><input class="cell num-in" data-k="cost" inputmode="decimal" dir="ltr" value="${UI.esc(l.UnitCost)}" placeholder="غير معروفة"></td>
          <td><input class="cell" data-k="notes" maxlength="200" value="${UI.esc(l.Notes)}"></td>
          <td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="rm">حذف</button></td>
        </tr><tr class="line-msg" data-msg="${i}" hidden><td colspan="6"></td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="6"><button type="button" class="btn btn-ghost btn-sm" data-act="add">إضافة سطر</button>
          <small class="muted">نفس الصنف يمكن إدخاله في أكثر من مكان بنفس التكلفة.</small></td></tr></tfoot></table>`;
    }
    const isC = st.tab === 'customer', list = st[st.tab];
    return `<table class="lines"><thead><tr><th style="width:45%">${isC ? 'العميل' : 'المورد'}</th><th class="num" style="width:18%">${isC ? 'المستحق لنا' : 'المستحق علينا'}</th><th>ملاحظات</th><th></th></tr></thead><tbody>
      ${list.map((l, i) => `<tr data-i="${i}">
        <td><input class="cell" list="${isC ? 'obCustomers' : 'obSuppliers'}" data-k="party" value="${UI.esc(l._text || '')}" placeholder="اكتب الاسم أو الكود"></td>
        <td class="num"><input class="cell num-in" data-k="amount" inputmode="decimal" dir="ltr" value="${UI.esc(l.Amount)}"></td>
        <td><input class="cell" data-k="notes" maxlength="200" value="${UI.esc(l.Notes)}"></td>
        <td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="rm">حذف</button></td>
      </tr><tr class="line-msg" data-msg="${i}" hidden><td colspan="4"></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4"><button type="button" class="btn btn-ghost btn-sm" data-act="add">إضافة ${isC ? 'عميل' : 'مورد'}</button>
        ${isC ? '<small class="muted">العميل النقدي لا يظهر لأنه لا يمكن أن يكون عليه رصيد.</small>' : ''}</td></tr></tfoot></table>`;
  }

  function renderSection() {
    $('[data-ref=section]').innerHTML = sectionHtml();
    root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === st.tab));
    validate();
  }

  /** تحقق فوري + إجماليات محلية للعرض (الإجماليات الرسمية من الخادم في المعاينة) */
  function validate() {
    let problems = 0;
    const mark = (i, msg) => {
      const tr = $(`tr[data-i="${i}"]`), mr = $(`tr[data-msg="${i}"]`);
      if (!tr) return;
      tr.classList.toggle('bad', !!msg); mr.hidden = !msg; mr.firstElementChild.textContent = msg || '';
    };
    // المخزون
    const seen = {}, cost = {}; let sQty = 0, sVal = 0, sNoCost = 0; const byLoc = {};
    st.stock.forEach((l, i) => {
      let msg = '';
      const empty = !l._text && !l.LocationID && !l.Quantity && !l.UnitCost;
      if (!empty) {
        const key = l.ItemID + '|' + l.LocationID;
        if (!l.ItemID) msg = 'اختر الصنف من القائمة.';
        else if (!l.LocationID) msg = 'اختر مكان التخزين.';
        else if (seen[key]) msg = 'نفس الصنف مكرر في نفس المكان.';
        else if (meta.postedStockKeys[key]) msg = `له رصيد افتتاحي معتمد في هذا المكان (${meta.postedStockKeys[key]}).`;
        else if (!isInt(l.Quantity)) msg = 'الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.';
        else if (l.UnitCost !== '' && !isPos(l.UnitCost)) msg = 'التكلفة يجب أن تكون أكبر من صفر أو تُترك فارغة.';
        else if (cost.hasOwnProperty(l.ItemID) && cost[l.ItemID] !== digits(l.UnitCost)) msg = 'تكلفة الصنف يجب أن تكون واحدة في كل الأماكن (أو فارغة في كل السطور).';
        if (l.ItemID && l.LocationID) seen[key] = true;
        if (l.ItemID) cost[l.ItemID] = cost.hasOwnProperty(l.ItemID) ? cost[l.ItemID] : digits(l.UnitCost);
        if (!msg) {
          const q = Number(digits(l.Quantity)); sQty += q; byLoc[l.LocationID] = (byLoc[l.LocationID] || 0) + q;
          if (l.UnitCost === '') sNoCost += q; else sVal += q * Number(digits(l.UnitCost));
        }
      }
      if (st.tab === 'stock') mark(i, msg);
      if (msg) problems++;
    });
    // العملاء والموردون
    const partyCheck = (type, keyType) => {
      const s = {}; let total = 0, n = 0;
      st[type].forEach((l, i) => {
        let msg = '';
        const empty = !l._text && !l.Amount;
        if (!empty) {
          if (!l.PartyID) msg = 'اختر الاسم من القائمة.';
          else if (s[l.PartyID]) msg = 'مكرر في نفس العملية.';
          else if (meta.postedPartyKeys[keyType + '|' + l.PartyID]) msg = `له رصيد افتتاحي معتمد (${meta.postedPartyKeys[keyType + '|' + l.PartyID]}).`;
          else if (!isPos(l.Amount)) msg = 'المبلغ يجب أن يكون أكبر من صفر.';
          if (l.PartyID) s[l.PartyID] = true;
          if (!msg) { total += Number(digits(l.Amount)); n++; }
        }
        if (st.tab === type) mark(i, msg);
        if (msg) problems++;
      });
      return { total: Math.round(total * 100) / 100, n };
    };
    const c = partyCheck('customer', 'CUSTOMER'), s = partyCheck('supplier', 'SUPPLIER');
    const stockN = st.stock.filter(l => l.ItemID && l.LocationID && isInt(l.Quantity)).length;
    root.querySelector('[data-count=stock]').textContent = stockN ? `(${stockN})` : '';
    root.querySelector('[data-count=customer]').textContent = c.n ? `(${c.n})` : '';
    root.querySelector('[data-count=supplier]').textContent = s.n ? `(${s.n})` : '';
    $('[data-ref=totals]').innerHTML = totalsHtml({ stockQty: sQty, stockLines: stockN, stockQtyByLocation: byLoc, stockValueKnown: Math.round(sVal * 100) / 100,
      stockQtyWithoutCost: sNoCost, itemsWithoutCost: new Set(st.stock.filter(l => l.ItemID && l.UnitCost === '').map(l => l.ItemID)).size,
      customers: c.n, customersTotal: c.total, suppliers: s.n, suppliersTotal: s.total }, locNames);
    return problems;
  }

  root.addEventListener('input', e => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const l = st[st.tab][Number(tr.dataset.i)], k = e.target.dataset.k, v = e.target.value;
    if (k === 'item') { l._text = v.trim(); l.ItemID = itemByLabel[l._text] || ''; }
    else if (k === 'party') { l._text = v.trim(); l.PartyID = (st.tab === 'customer' ? custByLabel : suppByLabel)[l._text] || ''; }
    else if (k === 'qty') l.Quantity = v.trim();
    else if (k === 'cost') l.UnitCost = v.trim();
    else if (k === 'amount') l.Amount = v.trim();
    else if (k === 'notes') l.Notes = v;
    validate();
  });
  root.addEventListener('change', e => {
    if (e.target.dataset.k !== 'loc') return;
    st.stock[Number(e.target.closest('tr').dataset.i)].LocationID = e.target.value; validate();
  });
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { st.tab = t.dataset.tab; renderSection(); return; }
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'add') {
      st[st.tab].push(st.tab === 'stock' ? { ItemID: '', LocationID: '', Quantity: '', UnitCost: '', Notes: '' } : { PartyID: '', Amount: '', Notes: '' });
      renderSection(); const ins = root.querySelectorAll('[data-k=item],[data-k=party]'); if (ins.length) ins[ins.length - 1].focus();
    } else if (act === 'rm') { st[st.tab].splice(Number(b.closest('tr').dataset.i), 1); renderSection(); }
    else if (act === 'save') save(false, b);
    else if (act === 'post') save(true, b);
    else if (act === 'cancel') cancelDraft(b);
  });

  const showErr = m => { const el = $('[data-ref=err]'); el.textContent = m || ''; el.hidden = !m; };
  const lock = on => root.querySelectorAll('.doc-actions .btn').forEach(x => { x.disabled = on; });

  async function save(thenPreview, btn) {
    showErr('');
    if (validate()) return showErr('صحّح الأخطاء الموضحة في السطور (راجع الأقسام الثلاثة).');
    const nonEmpty = l => l._text || l.LocationID || l.Quantity || l.UnitCost || l.Amount;
    const payload = {
      OpeningID: st.id, OpeningDate: $('[name=OpeningDate]').value, Notes: $('[name=Notes]').value.trim(),
      stockLines: st.stock.filter(nonEmpty).map(l => ({ ItemID: l.ItemID, LocationID: l.LocationID, Quantity: l.Quantity, UnitCost: l.UnitCost, Notes: l.Notes })),
      customerLines: st.customer.filter(nonEmpty).map(l => ({ PartyID: l.PartyID, Amount: l.Amount, Notes: l.Notes })),
      supplierLines: st.supplier.filter(nonEmpty).map(l => ({ PartyID: l.PartyID, Amount: l.Amount, Notes: l.Notes }))
    };
    if (!payload.stockLines.length && !payload.customerLines.length && !payload.supplierLines.length) return showErr('أضف سطرًا واحدًا على الأقل.');
    lock(true); UI.busy(btn, true, 'جارٍ الحفظ…');
    const first = !st.id;
    try {
      const saved = await Api.call(first ? 'opening.saveDraft' : 'opening.updateDraft', payload, { requestId: st.saveReq });
      st.id = saved.header.OpeningID; st.saveReq = Api.newRequestId();
      if (first) history.replaceState(null, '', '#opening/' + st.id);
      UI.toast(`تم حفظ المسودة ${saved.header.OpeningNo}.`);
      renderOpeningEditor(host, meta, saved);
      if (thenPreview) {
        const posted = await previewAndPost(saved);   // المعاينة من بيانات الخادم المحفوظة
        if (posted) renderOpeningView(host, posted);
      }
    } catch (e) { lock(false); UI.busy(btn, false); showErr(e.message); }
  }

  async function cancelDraft(btn) {
    if (!await UI.confirm(`إلغاء المسودة ${h.OpeningNo}؟ ستبقى محفوظة كعملية ملغاة بدون أي أثر.`, 'إلغاء المسودة', true)) return;
    lock(true); UI.busy(btn, true, 'جارٍ الإلغاء…');
    try {
      const r = await Api.call('opening.cancel', { id: st.id }, { requestId: 'cancel-' + st.id });
      UI.toast('تم إلغاء المسودة.'); renderOpeningView(host, r);
    } catch (e) { lock(false); UI.busy(btn, false); showErr(e.message); }
  }

  renderSection();
  if (errMsg) showErr(errMsg);
}
