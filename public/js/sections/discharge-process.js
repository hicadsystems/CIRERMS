import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { navigate } from '../core/router.js';
import { formatDisplayDate, parseDisplayDate, wireDateField } from '../core/dates.js';
import { h } from '../ui/html.js';
import { CARD, INPUT } from '../ui/classes.js';
import { button, actionGroup } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { listView } from '../ui/list-view.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { ratingSearch } from '../ui/rating-search.js';
import { facts } from '../ui/facts.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { pill } from '../ui/pill.js';
import { toast } from '../ui/toast.js';
import { inPageTabs } from '../ui/tabs.js';
import { filterBar, rowTips } from './disciplinary-parts.js';

const BASE = '/api/discharge';
const fmt = (v) => formatDisplayDate(v) || '';
const cell = (v) => fmt(v) || '—';
const years = (n) => (n === null || n === undefined ? '' : `${n} ${n === 1 ? 'year' : 'years'}`);
const nameOf = (r) => String(r.name || [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ')).toUpperCase();
/** A name cell: the name, then the rate and what else helps tell two ratings apart, then the pending-case warning. */
const nameCell = (r, more) => h('div', { className: 'grid justify-items-start gap-1' }, [
  h('span', { text: nameOf(r) }),
  h('span', { className: 'text-xs text-muted-foreground', text: [r.rate, more].filter(Boolean).join(' · ') }),
  r.pendingCases ? pill('Pending case', 'warning') : null,
]);
const dateField = (name, value = '', label = 'dd/mm/yyyy', hint = '') => field({
  label, hint, control: wireDateField(textInput({ name, value: formatDisplayDate(value), placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10' })),
});
const dateValue = (form, name) => parseDisplayDate(form.querySelector(`[name="${name}"]`)?.value || '');
const fieldValue = (form, name) => String(form.querySelector(`[name="${name}"]`)?.value || '').trim();
const lookupOptions = (items) => items.map((x) => ({ value: x.id, label: x.name }));
const toQuery = (values) => new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined));
const bodyText = (message) => h('p', { className: 'text-sm leading-relaxed', text: message });

export async function mountProcess(outlet) {
  const o = (await api.get(`${BASE}/options`)).data;
  let activeTab = 'due';
  let dueFilters = { q: '', branchId: '', rateId: '', entryModeId: '' };
  let proposalItems = [];
  let selectedProposalId = '';
  try {
    proposalItems = (await loadProposals()).filter((p) => Number(p.pending) > 0);
  } catch (error) {
    toast(error.message || 'Could not load discharge proposals.', 'error');
  }

  function pendingCaseWarning(count, openPending) {
    return h('div', { className: 'flex flex-wrap items-center gap-2 rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning' }, [
      h('span', { text: `This rating has ${count} pending disciplinary case(s). Nothing blocks discharge; review them before processing.` }),
      can('disciplinary.pending', 'view')
        ? button({ label: 'Open Pending Cases', variant: 'ghost', onClick: openPending })
        : null,
    ]);
  }

  const dueSummary = h('p', { className: 'mb-3 text-sm text-muted-foreground', text: 'Loading due ratings…' });
  const tabs = inPageTabs({
    tabs: [{ key: 'due', label: 'Due for Discharge' }, { key: 'proposals', label: 'Proposals' }],
    active: activeTab,
    pills: true,
    onChange: (key) => { activeTab = key; draw(); },
  });
  let allDueCount = null;
  tabs.setCount('proposals', proposalItems.reduce((sum, p) => sum + Number(p.pending || 0), 0));
  const dueList = listView({
    columns: [
      { label: 'Official No', key: 'serviceNumber' },
      { label: 'Name', render: (r) => nameCell(r, r.branch) },
      { label: 'Age', render: (r) => pill(`${r.age ?? '—'} years`, r.ageBand) },
      { label: 'Service', render: (r) => pill(`${r.yearsService ?? '—'} years`, r.serviceBand) },
    ],
    load: async ({ page, pageSize }) => {
      const params = toQuery({ ...dueFilters, page, pageSize });
      const res = await api.get(`${BASE}/due?${params}`);
      const total = Number(res.data.meta.total || 0);
      const alreadyProposed = Number(res.data.inProposalCount || 0);
      dueSummary.replaceChildren(
        h('b', { className: 'text-foreground', text: String(total) }),
        ` ${total === 1 ? 'rating is' : 'ratings are'} due`,
        alreadyProposed ? `, ${alreadyProposed} already in a proposal` : '',
      );
      if (!Object.values(dueFilters).some(Boolean)) {
        allDueCount = total;
        tabs.setCount('due', total);
      } else if (allDueCount !== null) tabs.setCount('due', allDueCount);
      return { data: res.data.items, meta: res.data.meta };
    },
    onPick: dueDetails,
    rowKey: (r) => r.serviceNumber,
    card: { title: nameOf, subtitle: (r) => `${r.serviceNumber} · ${r.branch || '—'}`, aside: (r) => pill(`${r.yearsService ?? '—'} yrs`, r.serviceBand) },
    empty: { icon: 'users', title: 'Nobody Is Due', text: 'No rating matches these filters. Widen your search or change the filters.' },
    autoLoad: false,
  });
  rowTips(dueList.el);
  const progressBar = h('div', { className: 'cirerms-progress-bar', dataset: { level: 'low' } });
  const progressText = h('p', { className: 'shrink-0 text-xs text-muted-foreground' }, [h('b', { className: 'text-foreground', text: '0' }), ' of 0 have an exit type']);
  const proposalProgress = h('section', { className: `${CARD} mb-3 flex items-center gap-3 p-3` }, [
    h('div', { className: 'cirerms-progress-track flex-1' }, progressBar),
    progressText,
  ]);
  const proposalSelector = h('div', { className: 'mb-3' });
  const proposalRows = listView({
    columns: [
      { label: 'Official No', key: 'serviceNumber' },
      { label: 'Name', render: (r) => nameCell(r, r.currentShip) },
      { label: 'Exit Type', render: (r) => h('div', { className: 'grid gap-1' }, [
        exitTypePill(r),
        r.exitDate ? h('span', { className: 'text-xs text-muted-foreground', text: fmt(r.exitDate) }) : null,
      ]) },
      { label: 'Proposal', key: 'proposalNumber' },
    ],
    load: async ({ page, pageSize }) => {
      const params = toQuery({ proposalId: selectedProposalId, page, pageSize });
      const res = await api.get(`${BASE}/proposals/rows?${params}`);
      const total = Number(res.data.meta.total || 0);
      const processed = Number(res.data.processed || 0);
      progressBar.style.width = `${total ? Math.round((processed / total) * 100) : 0}%`;
      progressBar.dataset.level = processed === total && total ? 'high' : processed ? 'mid' : 'low';
      progressText.replaceChildren(h('b', { className: 'text-foreground', text: String(processed) }), ` of ${total} have an exit type`);
      if (!selectedProposalId) tabs.setCount('proposals', total);
      return { data: res.data.items, meta: res.data.meta };
    },
    onPick: processRow,
    rowKey: (r) => r.id,
    card: { title: nameOf, subtitle: (r) => `${r.serviceNumber} · ${r.proposalNumber}`, aside: (r) => {
      return exitTypePill(r);
    } },
    empty: { icon: 'list', title: 'No Ratings to Process', text: 'Create a proposal from ratings due for discharge, or add a current rating.' },
    autoLoad: false,
  });

  rowTips(proposalRows.el);

  function exitTypePill(row) {
    const type = o.exitTypes.find((x) => Number(x.id) === Number(row.exitTypeId));
    return pill(row.exitType || 'Not processed', type ? (type.isDeath ? 'error' : 'info') : 'neutral');
  }

  const dueBar = filterBar({
    fields: [
      { name: 'q', label: 'Official No or Name', type: 'text', placeholder: 'e.g. B0539 or Okafor', span: 'col-span-2 phone:col-span-1' },
      { name: 'branchId', label: 'Branch', type: 'select', options: lookupOptions(o.branches), placeholder: 'All Branches' },
      { name: 'rateId', label: 'Rate', type: 'select', options: lookupOptions(o.rates), placeholder: 'All Rates' },
      { name: 'entryModeId', label: 'Entry Mode', type: 'select', options: lookupOptions(o.entryModes), placeholder: 'All Entry Modes' },
    ],
    onChange: (values) => { dueFilters = { ...values }; dueList.reload({ resetPage: true }); },
  });
  const dueFiltersPanel = dueBar.el;

  const create = can('discharge.process', 'add')
    ? button({ label: 'Create Proposal', icon: 'plus', variant: 'primary', onClick: createProposal })
    : null;
  const add = can('discharge.process', 'add')
    ? button({ label: 'Add Rating', icon: 'user-plus', variant: 'primary', onClick: addRating })
    : null;
  draw();
  dueList.reload();

  function draw() {
    if (activeTab === 'due') {
      outlet.replaceChildren(
        pageHeader({ title: 'Process Discharge', subtitle: 'Ratings due for discharge; make a proposal of them', actions: create }),
        tabs.el, dueFiltersPanel, dueSummary, dueList.el,
      );
      return;
    }
    outlet.replaceChildren(
      pageHeader({ title: 'Process Discharge', subtitle: 'Process each rating in a proposal', actions: add }),
      tabs.el, proposalSelector, proposalProgress, proposalRows.el,
    );
    refreshProposalSelector();
    proposalRows.reload({ resetPage: true });
  }

  async function createProposal() {
    if (!can('discharge.process', 'add')) return;
    try {
      const due = await getAllDue();
      if (!due.length) { toast('There are no ratings matching these filters.', 'error'); return; }
      const fresh = due.filter((r) => !r.proposalNumber);
      const flagged = fresh.filter((r) => r.pendingCases > 0);
      const dlg = openDialog({
        title: 'Create Proposal',
        body: h('div', { className: 'grid gap-3' }, [
          facts([
            ['Proposal Number', o.proposalNumber || 'Generated on save'],
            ['Branch', o.branches.find((x) => String(x.id) === dueFilters.branchId)?.name || 'All branches'],
            ['Rate', o.rates.find((x) => String(x.id) === dueFilters.rateId)?.name || 'All rates'],
            ['Entry Mode', o.entryModes.find((x) => String(x.id) === dueFilters.entryModeId)?.name || 'All entry modes'],
            ['Ratings to Add', String(fresh.length)],
            ['Proposed By', o.proposedBy || 'Current user'],
          ]),
          fresh.length < due.length ? h('p', { className: `${CARD} p-3 text-sm text-warning`, text: `${due.length - fresh.length} already in a proposal will be left out.` }) : null,
          flagged.length ? h('div', { className: 'flex flex-wrap items-center gap-2 rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning' }, [
            h('span', { text: `${flagged.length} selected rating(s) have pending disciplinary cases. This does not block the proposal.` }),
            can('disciplinary.pending', 'view') ? button({ label: 'Open Pending Cases', variant: 'ghost', onClick: () => {
              dlg.close();
              navigate('#disciplinary/pending');
            } }) : null,
          ]) : null,
          bodyText(fresh.length ? 'Every eligible rating matching these filters will be added. Creating a proposal does not change anyone’s service record.' : 'Everyone matching these filters is already in a proposal. Process them in Proposals, or change the filters.'),
        ]),
      });
      dlg.setFooter([
        button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }),
        fresh.length ? button({ label: 'Create Proposal', variant: 'primary', onClick: async () => {
          try {
            const result = await api.post(`${BASE}/proposals`, { serviceNumbers: fresh.map((r) => r.serviceNumber) });
            toast(`Proposal ${result.data.proposalNumber} created.`);
            dlg.close();
            await refreshProposals();
            selectedProposalId = String(result.data.id);
            activeTab = 'proposals';
            draw();
          } catch (error) { toast(error.message || 'Could not create proposal.', 'error'); }
        } }) : button({ label: 'Go to Proposals', variant: 'primary', onClick: () => { dlg.close(); activeTab = 'proposals'; draw(); } }),
      ]);
    } catch (error) {
      toast(error.message || 'Could not load due ratings.', 'error');
    }
  }

  async function getAllDue() {
    const all = [];
    let page = 1;
    let totalPages = 1;
    do {
      const params = toQuery({ ...dueFilters, page });
      const res = await api.get(`${BASE}/due?${params}`);
      all.push(...res.data.items);
      totalPages = res.data.meta.totalPages;
      page += 1;
    } while (page <= totalPages);
    return all;
  }

  function dueDetails(r) {
    let dlg;
    dlg = openDialog({
      title: nameOf(r),
      size: 'md',
      body: h('div', { className: 'grid gap-3' }, [
        r.pendingCases ? pendingCaseWarning(r.pendingCases, () => {
          dlg.close();
          navigate('#disciplinary/pending');
        }) : null,
        facts([
          ['Official No', r.serviceNumber], ['Rate', r.rate || ''], ['Branch', r.branch || ''],
          ['Entry Mode', r.entryMode || ''], ['Date of Birth', fmt(r.dateOfBirth)], ['Age', years(r.age)],
          ['Date Enlisted', fmt(r.dateEmployed)], ['Length of Service', years(r.yearsService)],
          ['Current Ship', r.currentShip || ''], ['Proposal', r.proposalNumber || ''],
          ['Last Re-engagement', r.lastReengagement ? `${fmt(r.lastReengagement.date)} for ${r.lastReengagement.periodMonths} months (ended ${fmt(r.lastReengagement.untilDate)})` : 'None'],
        ]),
      ]),
    });
    const actions = [
      can('ratings.edit', 'view') ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); navigate(`#ratings/edit/${encodeURIComponent(r.serviceNumber)}`); } }) : null,
      r.proposalId ? button({ label: 'Go to Proposal', icon: 'list', variant: 'primary', onClick: () => {
        selectedProposalId = String(r.proposalId);
        activeTab = 'proposals';
        dlg.close();
        draw();
      } }) : button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }),
    ].filter(Boolean);
    dlg.setFooter(actionGroup(actions));
  }

  function processRow(row) {
    let dlg;
    dlg = openDialog({
      title: nameOf(row),
      size: 'lg',
      body: h('div', { className: 'grid gap-3' }, [
        row.pendingCases ? pendingCaseWarning(row.pendingCases, () => {
          dlg.close();
          navigate('#disciplinary/pending');
        }) : null,
        facts([
          ['Proposal', row.proposalNumber], ['Proposed By', row.proposedBy || ''],
          ['Official No', row.serviceNumber], ['Rate', row.rate || ''],
          ['Age', years(row.age)], ['Length of Service', years(row.yearsService)],
          ['Date Enlisted', fmt(row.dateEmployed)], ['Current Ship', row.currentShip || ''],
          ['Last Re-engagement', row.lastReengagement ? `${fmt(row.lastReengagement.date)} for ${row.lastReengagement.periodMonths} months (ended ${fmt(row.lastReengagement.untilDate)})` : 'None'],
          ['Exit Type', row.exitType || 'Not processed'], ['Exit Date', fmt(row.exitDate)],
          ['Exit Reason', row.exitReason || ''], ['Comment', row.comment || ''],
        ]),
      ]),
    });
    const actions = [
      can('ratings.edit', 'view') ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); navigate(`#ratings/edit/${encodeURIComponent(row.serviceNumber)}`); } }) : null,
      can('discharge.process', 'delete') ? button({ label: 'Remove', icon: 'trash-2', variant: 'danger', onClick: () => removeFromProposal(row, dlg) }) : null,
      can('discharge.process', 'edit') ? button({ label: 'Re-engage', icon: 'refresh-cw', variant: 'outline', onClick: () => reengageRow(row, dlg) }) : null,
      can('discharge.process', 'edit') ? button({ label: 'Process', icon: 'pencil', variant: 'primary', onClick: () => { dlg.close(); processForm(row); } }) : null,
      button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }),
    ].filter(Boolean);
    dlg.setFooter(actionGroup(actions));
  }

  async function removeFromProposal(row, dlg) {
    if (!await confirmDialog({ title: 'Remove from Proposal', message: `${nameOf(row)} will remain current and can be proposed again later.`, confirmLabel: 'Remove Rating', danger: true })) return;
    try {
      await api.del(`${BASE}/proposals/${row.proposalId}/ratings/${encodeURIComponent(row.serviceNumber)}`);
      toast('Removed from proposal.');
      dlg.close();
      await refreshProposals();
    } catch (error) { toast(error.message || 'Could not remove rating.', 'error'); }
  }

  function processForm(row) {
    const selectableTypes = o.exitTypes.filter((x) => !x.keepsCurrent);
    const exitSelect = selectInput({ name: 'exitTypeId', options: lookupOptions(selectableTypes), value: row.exitTypeId || '', placeholder: '-- Select Exit Type --' });
    const status = selectInput({ name: 'status', value: row.status, options: [
      { value: 'pending', label: 'Pending' }, { value: 'closed', label: 'Closed' },
    ], placeholder: null });
    const comment = h('textarea', { name: 'comment', maxlength: '500', rows: '3', className: INPUT });
    comment.value = row.comment || '';
    const body = h('form', { className: 'grid grid-cols-2 gap-3 phone:grid-cols-1', onSubmit: (event) => event.preventDefault() }, [
      h('div', { className: 'col-span-2 phone:col-span-1' }, [
        row.pendingCases ? pendingCaseWarning(row.pendingCases, () => {
          dlg.close();
          navigate('#disciplinary/pending');
        }) : null,
        facts([
          ['Proposal', row.proposalNumber], ['Proposed By', row.proposedBy || ''],
          ['Official No', row.serviceNumber], ['Rate', row.rate || ''],
          ['Age', years(row.age)], ['Length of Service', years(row.yearsService)],
          ['Date Enlisted', fmt(row.dateEmployed)], ['Current Ship', row.currentShip || ''],
          ['Last Re-engagement', row.lastReengagement ? `${fmt(row.lastReengagement.date)} for ${row.lastReengagement.periodMonths} months (ended ${fmt(row.lastReengagement.untilDate)})` : 'None'],
        ]),
      ]),
      field({ label: 'Exit Type', control: exitSelect }),
      dateField('exitDate', row.exitDate, 'Exit Date', 'A date after today is scheduled; the rating stays current until then.'),
      field({ label: 'Exit Reason', control: textInput({ name: 'exitReason', value: row.exitReason, maxlength: '100', placeholder: 'Why is the rating leaving?' }), hint: 'Up to 100 characters.' }),
      field({ label: 'Approved By', optional: true, control: textInput({ name: 'approvedBy', value: row.approvedBy, maxlength: '150', placeholder: 'Name of approving authority' }) }),
      field({ label: 'Status', control: status, hint: 'Closed is final.' }),
      field({ label: 'Comment', optional: true, control: comment, className: 'col-span-2 phone:col-span-1' }),
    ]);
    const docs = ['deathCertificate', 'condolenceLetter', 'dependentFundEvidence', 'swornAffidavit'];
    const labels = ['Death Certificate', 'Condolence Letter', 'Evidence of Payment of Dependants Fund', 'Sworn Affidavit as Next of Kin'];
    const checks = h('div', { className: 'col-span-2 grid grid-cols-2 gap-2 phone:col-span-1 phone:grid-cols-1' }, docs.map((name, i) => field({
      label: labels[i],
      control: h('input', { type: 'checkbox', name, checked: !!row[name], className: 'h-4 w-4 accent-primary' }),
    })));
    const deathFields = h('div', { className: 'col-span-2 phone:col-span-1' }, [
      h('p', { className: 'mb-2 text-sm font-medium', text: 'Documents Available' }),
      checks,
      h('p', { className: 'mt-1 text-xs text-muted-foreground', text: 'These are recorded only; a missing document does not stop discharge.' }),
    ]);
    const updateDeathFields = () => {
      const selected = selectableTypes.find((x) => String(x.id) === fieldValue(body, 'exitTypeId'));
      deathFields.classList.toggle('hidden', !(selected && selected.isDeath));
    };
    body.addEventListener('change', (event) => { if (event.target.getAttribute && event.target.getAttribute('name') === 'exitTypeId') updateDeathFields(); });
    updateDeathFields();
    body.append(deathFields);

    let dlg;
    dlg = openDialog({ title: 'Process Discharge', size: 'lg', body });
    const actions = [
      can('ratings.edit', 'view') ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); navigate(`#ratings/edit/${encodeURIComponent(row.serviceNumber)}`); } }) : null,
      can('discharge.process', 'edit') ? button({ label: 'Save', variant: 'primary', onClick: saveRow }) : null,
      button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }),
    ].filter(Boolean);
    dlg.setFooter(actionGroup(actions));

    async function saveRow() {
      clearFieldErrors(body);
      const exitDate = dateValue(body, 'exitDate');
      const data = {
        exitTypeId: Number(fieldValue(body, 'exitTypeId')) || null,
        exitDate: exitDate || '',
        exitReason: fieldValue(body, 'exitReason'),
        approvedBy: fieldValue(body, 'approvedBy'),
        comment: fieldValue(body, 'comment'),
        status: fieldValue(body, 'status'),
      };
      docs.forEach((name) => { data[name] = !!body.querySelector(`[name="${name}"]`)?.checked; });
      const errors = {};
      if (!data.exitTypeId) errors.exitTypeId = 'Choose an exit type.';
      if (body.querySelector('[name="exitDate"]').value && exitDate === null) errors.exitDate = 'Use a real date in dd/mm/yyyy format.';
      if (data.status === 'closed' && !exitDate) errors.exitDate = 'A closed discharge needs the exit date.';
      if (exitDate && row.dateEmployed && exitDate < String(row.dateEmployed).slice(0, 10)) errors.exitDate = 'Exit date cannot be before the date enlisted.';
      if (!data.exitReason) errors.exitReason = 'Give the reason the rating is leaving.';
      if (data.exitReason.length > 100) errors.exitReason = 'The reason is limited to 100 characters.';
      if (!['pending', 'closed'].includes(data.status)) errors.status = 'Choose Pending or Closed.';
      if (Object.keys(errors).length) { setFieldErrors(body, errors); return; }
      if (data.status === 'closed') {
        const future = data.exitDate > o.today;
        const message = h('div', { className: 'grid gap-3' }, [
          bodyText('Closing a discharge is final and cannot be reopened here.'),
          facts([['Rating', nameOf(row)], ['Exit Type', selectableTypes.find((x) => Number(x.id) === data.exitTypeId)?.name || ''], ['Exit Date', fmt(data.exitDate)]]),
          bodyText(future ? `The rating stays current until ${fmt(data.exitDate)}; this discharge will be scheduled.` : `The rating moves to Former Ratings now, with ${fmt(data.exitDate)} as the exit date.`),
        ]);
        if (!await confirmDialog({ title: 'Close Discharge', message, confirmLabel: 'Close Discharge', danger: true, icon: 'lock' })) return;
      }
      try {
        await api.put(`${BASE}/proposals/${row.proposalId}/ratings/${encodeURIComponent(row.serviceNumber)}`, data);
        toast(data.status === 'closed' ? 'Discharge closed.' : 'Discharge saved as pending.');
        dlg.close();
        await refreshProposals();
      } catch (error) {
        if (error.fields) setFieldErrors(body, error.fields);
        else toast(error.message || 'Could not save discharge.', 'error');
      }
    }

  }

  function addRating() {
    const choices = proposalItems.map((p) => ({ value: p.id, label: `${p.proposalNumber} · ${p.pending} to process` }));
    choices.push({ value: '__new', label: `New proposal (${o.proposalNumber || 'next number'})` });
    const rating = ratingSearch({ name: 'serviceNumber', status: 'current', ariaLabel: 'Add Rating', placeholder: 'Find a current rating' });
    const candidateInfo = h('div', {});
    let candidateRequest = 0;
    let candidateCanAdd = false;
    const proposal = selectInput({
      name: 'proposalId',
      value: selectedProposalId || (proposalItems[0] && proposalItems[0].id) || '',
      options: choices,
      placeholder: '-- Choose Proposal --',
    });
    const dlg = openDialog({
      title: 'Add Rating',
      size: 'md',
      body: h('div', { className: 'grid gap-3' }, [
        field({ label: 'Rating', control: rating }),
        field({ label: 'Proposal', control: proposal }),
        candidateInfo,
        bodyText('A rating must be current and cannot already be in another proposal or have a discharge.'),
      ]),
    });
    const addButton = button({ label: 'Add Rating', icon: 'user-plus', variant: 'primary', disabled: true, onClick: addSelectedRating });
    dlg.setFooter([
      button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }),
      addButton,
    ]);

    rating.addEventListener('change', async () => {
      const request = ++candidateRequest;
      candidateCanAdd = false;
      addButton.disabled = true;
      if (!rating.value) { candidateInfo.replaceChildren(); return; }
      candidateInfo.replaceChildren(h('p', { className: 'text-sm text-muted-foreground', text: 'Checking rating…' }));
      try {
        const candidate = (await api.get(`${BASE}/ratings/${encodeURIComponent(rating.value)}/candidate`)).data;
        if (request !== candidateRequest) return;
        const notes = [];
        if (candidate.pendingCases) {
          notes.push(pendingCaseWarning(candidate.pendingCases, () => {
            dlg.close();
            navigate('#disciplinary/pending');
          }));
        }
        if (candidate.isReengaged) {
          notes.push(h('p', { className: 'rounded-card border border-info/40 bg-info/10 p-3 text-sm text-info', text: `This rating is re-engaged until ${fmt(candidate.reengagementUntil)}.` }));
        }
        if (!candidate.canAdd) {
          const reason = candidate.status !== 'current' ? 'This rating has already left the service.'
            : candidate.proposalNumber ? `This rating is already in proposal ${candidate.proposalNumber}.`
              : 'This rating already has a discharge on file.';
          notes.push(h('p', { className: 'rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning', text: reason }));
        } else {
          notes.push(h('p', { className: 'text-sm text-muted-foreground', text: `${candidate.name} · ${candidate.rate || '—'} · ${candidate.branch || '—'}` }));
        }
        candidateCanAdd = candidate.canAdd;
        addButton.disabled = !candidateCanAdd;
        candidateInfo.replaceChildren(...notes);
      } catch (error) {
        if (request !== candidateRequest) return;
        candidateInfo.replaceChildren(h('p', { className: 'text-sm text-error', text: error.message || 'Could not check this rating.' }));
        toast(error.message || 'Could not check this rating.', 'error');
      }
    });

    async function addSelectedRating() {
      if (!rating.value || !candidateCanAdd) return;
      const chosen = fieldValue(dlg.body, 'proposalId');
      if (!chosen) { toast('Choose a proposal.', 'error'); return; }
      try {
        if (chosen === '__new') {
          const result = await api.post(`${BASE}/proposals`, { serviceNumbers: [rating.value] });
          selectedProposalId = String(result.data.id);
          toast(`${rating.value} added to ${result.data.proposalNumber}.`);
        } else {
          await api.post(`${BASE}/proposals/${chosen}/ratings`, { serviceNumber: rating.value });
          selectedProposalId = String(chosen);
          toast('Rating added to proposal.');
        }
        dlg.close();
        await refreshProposals();
      } catch (error) { toast(error.message || 'Could not add rating.', 'error'); }
    }
  }

  function reengageRow(row, parent) {
    const form = h('form', { className: 'grid gap-3', onSubmit: (event) => event.preventDefault() }, [
      facts([['Official No', row.serviceNumber], ['Rating', nameOf(row)], ['Proposal', row.proposalNumber]]),
      dateField('reengageDate', '', 'Re-engagement Date'),
      field({ label: 'Period (Months)', control: textInput({ name: 'periodMonths', type: 'number', min: '1', max: '120', step: '1', placeholder: 'e.g. 24' }) }),
      field({ label: 'Approved By', control: textInput({ name: 'approvedBy', maxlength: '150', placeholder: 'Name of approving authority' }) }),
      bodyText('Re-engagement is not a discharge. The rating stays current and leaves this proposal.'),
    ]);
    const dlg = openDialog({ title: 'Re-engage', size: 'md', body: form });
    dlg.setFooter([
      button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }),
      button({ label: 'Re-engage', icon: 'refresh-cw', variant: 'primary', onClick: async () => {
        clearFieldErrors(form);
        const reengageDate = dateValue(form, 'reengageDate');
        const periodMonths = Number(fieldValue(form, 'periodMonths'));
        const approvedBy = fieldValue(form, 'approvedBy');
        const errors = {};
        if (!reengageDate) errors.reengageDate = 'Enter a real date in dd/mm/yyyy format.';
        if (reengageDate && row.dateEmployed && reengageDate < String(row.dateEmployed).slice(0, 10)) errors.reengageDate = 'Re-engagement date cannot be before the date enlisted.';
        if (!Number.isInteger(periodMonths) || periodMonths < 1 || periodMonths > 120) errors.periodMonths = 'Use a whole number from 1 to 120.';
        if (!approvedBy) errors.approvedBy = 'Say who approved the re-engagement.';
        if (Object.keys(errors).length) { setFieldErrors(form, errors); return; }
        try {
          await api.post(`${BASE}/proposals/${row.proposalId}/ratings/${encodeURIComponent(row.serviceNumber)}/reengage`, { reengageDate, periodMonths, approvedBy });
          toast(`${nameOf(row)} re-engaged for ${periodMonths} months.`);
          dlg.close();
          parent.close();
          await refreshProposals();
        } catch (error) {
          if (error.fields) setFieldErrors(form, error.fields);
          else toast(error.message || 'Could not re-engage rating.', 'error');
        }
      } }),
    ]);
  }

  function refreshProposalSelector() {
    const select = selectInput({
      name: 'proposalId',
      value: selectedProposalId,
      options: proposalItems.map((p) => ({ value: p.id, label: `${p.proposalNumber} · proposed ${fmt(p.proposedAt)} by ${p.proposedBy || '—'} · ${p.pending} to process` })),
      placeholder: 'All Proposals',
      'aria-label': 'Proposal',
    });
    proposalSelector.onchange = (event) => {
      if (event.target.getAttribute && event.target.getAttribute('name') === 'proposalId') {
        selectedProposalId = String(event.target.value || '');
        proposalRows.reload({ resetPage: true });
      }
    };
    proposalSelector.replaceChildren(field({ label: 'Proposal', control: select, className: 'w-full desk:w-96' }));
  }

  async function loadProposals() {
    const all = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await api.get(`${BASE}/proposals?page=${page}`);
      all.push(...res.data.items);
      totalPages = res.data.meta.totalPages;
      page += 1;
    } while (page <= totalPages);
    return all;
  }

  async function refreshProposals() {
    try {
      proposalItems = (await loadProposals()).filter((p) => Number(p.pending) > 0);
      const ids = new Set(proposalItems.map((p) => String(p.id)));
      if (selectedProposalId && !ids.has(String(selectedProposalId))) selectedProposalId = '';
      tabs.setCount('proposals', proposalItems.reduce((sum, p) => sum + Number(p.pending || 0), 0));
      dueList.reload();
      if (activeTab === 'proposals') {
        refreshProposalSelector();
        proposalRows.reload({ resetPage: true });
      }
    } catch (error) {
      toast(error.message || 'Could not refresh proposals.', 'error');
    }
  }
}
