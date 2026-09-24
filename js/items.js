/** الأصناف — الكود يُولد في الخادم، متوسط التكلفة للعرض فقط، سعر البيع اختياري */
const ItemsPage = () => createCrudPage({
  title: 'الأصناف', addLabel: 'إضافة صنف', editTitle: 'تعديل صنف',
  listAction: 'items.list', saveAction: 'items.save', setActiveAction: 'items.setActive',
  managePerm: 'MANAGE_ITEMS', idField: 'ItemID', nameField: 'ItemName',
  searchPlaceholder: 'ابحث بالاسم أو الكود', searchKeys: ['ItemName', 'ItemCode'],
  columns: [
    { key: 'ItemCode', label: 'الكود', cls: 'mono' },
    { key: 'ItemName', label: 'اسم الصنف' },
    { label: 'سعر البيع', cls: 'num', render: r => r.SellingPrice === '' ? '<span class="muted">لم يُحدد</span>' : UI.esc(UI.money(r.SellingPrice)) },
    { label: 'متوسط التكلفة', cls: 'num', render: r => UI.esc(UI.money(r.AverageCost)) }
  ],
  form: (meta, row) => [
    ...(row ? [{ key: 'ItemCode', label: 'الكود', type: 'readonly' }] : []),
    { key: 'ItemName', label: 'اسم الصنف', required: true, max: 120 },
    { key: 'SellingPrice', label: 'سعر البيع (جنيه)', numeric: true, max: 12, hint: 'يمكن تركه فارغًا لحين تحديد السعر.' },
    ...(row ? [{ key: 'AverageCost', label: 'متوسط التكلفة', type: 'readonly', display: v => UI.money(v),
                 hint: 'يُحسب تلقائيًا من المشتريات في مرحلة لاحقة ولا يُعدل يدويًا.' }] : [])
  ]
});
