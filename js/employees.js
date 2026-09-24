/** الموظفين — موظف واحد حتى لو له أكثر من دور */
const EmployeesPage = () => createCrudPage({
  title: 'الموظفين', addLabel: 'إضافة موظف', editTitle: 'تعديل موظف',
  listAction: 'employees.list', saveAction: 'employees.save', setActiveAction: 'employees.setActive',
  managePerm: 'MANAGE_EMPLOYEES', idField: 'EmployeeID', nameField: 'EmployeeName',
  searchPlaceholder: 'ابحث بالاسم أو الكود أو الدور', searchKeys: ['EmployeeName', 'EmployeeCode', 'Role'],
  columns: [
    { key: 'EmployeeCode', label: 'الكود', cls: 'mono' },
    { key: 'EmployeeName', label: 'الاسم' },
    { key: 'Role', label: 'الدور' },
    { label: 'الأجر اليومي', cls: 'num', render: r => UI.esc(UI.money(r.DailyRate)) }
  ],
  form: (meta, row) => [
    ...(row ? [{ key: 'EmployeeCode', label: 'الكود', type: 'readonly' }] : []),
    { key: 'EmployeeName', label: 'الاسم', required: true, max: 80 },
    { key: 'Role', label: 'الدور', max: 80, hint: 'لو له أكثر من دور اكتبها معًا، مثل: سائق / مندوب.' },
    { key: 'DailyRate', label: 'الأجر اليومي (جنيه)', required: true, numeric: true, max: 12, default: meta.defaultDailyRate }
  ]
});
