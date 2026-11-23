/*
 * the rating's record (#ratings/edit/:serviceNumber) and My Details
 * (#ratings/my-details, the same record read-only for the signed-in rating).
 *
 * No banner: the avatar (the passport photo when there is one), the name, its
 * labels and the actions sit on one row; under them the thin completeness bar
 * (filled tabs out of ten); then the ten tabs. Details shows the four sections
 * as cards, each with Edit opening its form in a dialog; the other tabs are in
 * rating-children.js and rating-documents-block.js.
 *
 *   mountRatingRecord(outlet, ctx)   mountMyDetails(outlet)
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { getLookups } from '../core/lookups.js';
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { previewBlobModal } from '../core/dom.js';
import { formatDisplayDate, durationSince } from '../core/dates.js';
import { h, cx, fill } from '../ui/html.js';
import { CARD } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { card } from '../ui/card.js';
import { pill } from '../ui/pill.js';
import { photoAvatar } from '../ui/avatar.js';
import { factPanels } from '../ui/facts.js';
import { emptyState } from '../ui/empty-state.js';
import { pageHeader } from '../ui/page-header.js';
import { inPageTabs } from '../ui/tabs.js';
import { completeness } from '../ui/progress.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { setPhoneTitle } from '../shell/phone.js';
import { sectionByKey, sectionFields, wireCascades, readForm, displayRows } from './rating-fields.js';
import { CHILD_TABS, childPanel } from './rating-children.js';
import { documentsBlock } from './rating-documents-block.js';
import { dischargePills } from './discharge-record.js';
import { photoPicker, uploadPassport } from './rating-new.js';
import { ratingName, personName } from './rating-names.js';
import { disciplinePanel } from './disciplinary-parts.js';
import { appraisalList } from './appraisal-record.js';

const ALL_TABS = [{ key: 'details', label: 'Details' }, ...CHILD_TABS.map((t) => ({ key: t.key, label: t.label })), { key: 'documents', label: 'Documents' }];

function loadingNode() {
  return h('div', { className: 'flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground' }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
}

/**
 * Draws the record into `outlet`. data: { rating, children }.
 * Returns a cleanup function.
 */
function recordView(outlet, { data, readOnly, lookups, initialTab = 'details', disciplineCount = null }) {
  // what the person may do here (core/access.js); My Details is read-only and shows its own documents
  const may = {
    add: !readOnly && can('ratings.edit', 'add'),
    edit: !readOnly && can('ratings.edit', 'edit'),
    remove: !readOnly && can('ratings.edit', 'delete'),
    docs: readOnly || can('ratings.documents'),
    upload: !readOnly && can('ratings.documents', 'add'),
    removeDoc: !readOnly && can('ratings.documents', 'delete'),
  };
  // the Discipline tab (WP4): for whoever may view Concluded Cases, never on My Details, not counted in the completeness
  const mayDiscipline = !readOnly && can('disciplinary.concluded', 'view');
  const TABS = [...ALL_TABS.filter((t) => t.key !== 'documents' || may.docs), ...(mayDiscipline ? [{ key: 'discipline', label: 'Discipline' }] : [])];
  const state = { rating: data.rating, children: data.children || {}, tab: TABS.some((t) => t.key === initialTab) ? initialTab : 'details' };
  let docs = null;

  const head = h('section', { className: cx(CARD, 'mb-4 overflow-hidden') });
  const body = h('div');
  const tabs = inPageTabs({ tabs: TABS, active: state.tab, onChange: (key) => { state.tab = key; drawBody(); } });
  const sn = () => state.rating.service_number;

  const count = (key) => {
    if (key === 'discipline') return disciplineCount === null ? 0 : disciplineCount;
    if (key === 'documents') return (state.children.documents || []).length;
    const t = CHILD_TABS.find((x) => x.key === key);
    return t ? (state.children[t.bundleKey] || []).length : 0;
  };
  const percent = () => (1 + [...CHILD_TABS.map((t) => t.key), 'documents'].filter((k) => count(k) > 0).length) * 10;

  function drawHead() {
    const r = state.rating;
    const name = ratingName(r);
    setPhoneTitle(name);
    document.title = `${name} · CIRERMS`;
    const where = r.status === 'former' ? (r.exit_date ? `Left ${formatDisplayDate(r.exit_date)}` : 'Former') : r.current_ship_name || 'No current posting';
    const actions = [
      may.edit ? button({ label: 'Edit Details', icon: 'pencil', variant: 'primary', onClick: () => editSection('basic') }) : null,
      button({ label: 'Print Dossier', icon: 'printer', variant: 'blue', onClick: printDossier }),
      may.remove ? button({ label: 'Delete', icon: 'trash-2', variant: 'outline', className: 'text-destructive phone:hidden', onClick: removeRating }) : null,
    ];
    fill(head, [
      h('div', { className: 'flex flex-wrap items-center gap-3 p-4 desk:gap-4' }, [
        photoAvatar(personName(r), r.passport_photo_url, 'xl'),
        h('div', { className: 'min-w-0 flex-1' }, [
          h(readOnly ? 'h2' : 'h1', { className: 'break-words text-xl font-semibold tracking-tight', text: name }),
          h('div', { className: 'text-sm text-muted-foreground', text: [r.service_number, r.rate_name, where].filter(Boolean).join(' · ') }),
          h('div', { className: 'mt-1.5 flex flex-wrap gap-1.5' }, [
            pill(r.status === 'former' ? 'Former' : 'Current', r.status === 'former' ? 'neutral' : 'success'),
            r.branch_name ? pill(r.branch_name, 'info') : null,
            r.command_name ? pill(r.command_name, 'neutral') : null,
            r.status === 'current' ? dischargePills(r.service_number) : null,
          ]),
        ]),
        h('div', { className: 'flex flex-wrap gap-2 phone:w-full phone:[&>*]:flex-1' }, actions),
      ]),
      completeness({ percent: percent() }),
    ]);
    TABS.forEach((t) => tabs.setCount(t.key, t.key === 'details' ? '' : count(t.key)));
  }

  function drawBody() {
    if (docs) { docs.destroy(); docs = null; }
    if (state.tab === 'details') { fill(body, detailsTab()); return; }
    if (state.tab === 'discipline') {
      fill(body, disciplinePanel(sn(), { onLoaded: ({ meta }) => { disciplineCount = meta.total; tabs.setCount('discipline', meta.total); } }));
      return;
    }
    if (state.tab === 'documents') {
      docs = documentsBlock({
        serviceNumber: sn(),
        readOnly,
        canUpload: may.upload,
        canDelete: may.removeDoc,
        onCount: (n) => {
          state.children.documents = new Array(n).fill(null);
          drawHead();
        },
      });
      fill(body, docs.el);
      return;
    }
    const tab = CHILD_TABS.find((t) => t.key === state.tab);
    const panel = childPanel({
      serviceNumber: sn(),
      tab,
      rows: state.children[tab.bundleKey] || [],
      rating: state.rating,
      readOnly,
      canAdd: may.add,
      canEdit: may.edit,
      canDelete: may.remove,
      lookups,
      onChange: ({ items, currentShipName }) => {
        state.children[tab.bundleKey] = items || [];
        if (tab.key === 'drafting') state.rating = { ...state.rating, current_ship_name: currentShipName || null };
        drawHead();
        drawBody();
      },
    });
    // the appraisals sit under the Advancement tab (WP12): for whoever may view Recommendation and Grading, never on My Details
    fill(body, tab.key === 'advancement' && !readOnly && can('appraisal.grading', 'view') ? [panel, appraisalList(sn())] : panel);
  }

  function detailsTab() {
    const r = state.rating;
    const posting = (state.children.drafting || []).find((p) => !p.end_date);
    return card({ body: factPanels(['basic', 'official', 'contact', 'health'].map(sectionByKey).filter(Boolean).map((s) => {
      const rows = displayRows(s, r);
      if (s.key === 'official') {
        rows.splice(5, 0, ['Current Ship', r.current_ship_name ? `${r.current_ship_name}${posting && posting.start_date ? ` (${durationSince(posting.start_date)})` : ''}` : '']);
      }
      return {
        title: s.title,
        actions: !may.edit ? null : [button({ label: 'Edit', icon: 'pencil', variant: 'ghost', ariaLabel: `Edit ${s.title}`, onClick: () => editSection(s.key) })],
        rows,
      };
    })) });
  }

  function editSection(key) {
    const section = sectionByKey(key);
    const form = h('form', { novalidate: true, autocomplete: 'off' });
    const photo = key === 'basic' ? photoPicker({ currentUrl: state.rating.passport_photo_url }) : null;
    form.appendChild(h('div', { className: 'flex gap-6 phone:flex-col' }, [h('div', { className: 'min-w-0 flex-1' }, sectionFields(section, lookups, state.rating)), photo]));
    const dlg = openDialog({ title: `Edit ${section.title}`, size: key === 'basic' ? '2xl' : 'xl', body: form, onClose: () => photo && photo.release() });
    wireCascades(form, lookups);
    const saveBtn = button({ label: 'Save', icon: 'check', variant: 'primary', onClick: () => save() });
    dlg.setFooter([button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }), saveBtn]);
    form.addEventListener('submit', (e) => { e.preventDefault(); save(); });

    async function save() {
      clearFieldErrors(form);
      saveBtn.disabled = true;
      dlg.setDismissible(false);
      const before = sn();
      try {
        const res = await api.put(`/api/ratings/${encodeURIComponent(before)}`, readForm(form));
        state.rating = res.data.rating;
        state.children = res.data.children || state.children;
        const file = photo && photo.file();
        if (file) {
          try { state.rating = await uploadPassport(sn(), file); } catch (err) { toast(`Saved, but the photo was not: ${err.message}`, 'warning', { timeout: 6000 }); }
        }
        dlg.setDismissible(true);
        dlg.close('saved');
        toast(`${section.title} saved.`);
        if (sn() !== before && !readOnly) window.history.replaceState(null, '', `#ratings/edit/${encodeURIComponent(sn())}`);
        drawHead();
        drawBody();
      } catch (err) {
        dlg.setDismissible(true);
        saveBtn.disabled = false;
        if (err.fields) setFieldErrors(form, err.fields);
        toast(err.message || 'Could not save.', 'error');
      }
    }
  }

  async function printDossier() {
    try {
      const { blob, mimeType, fileName } = await api.fetchBlob(`/api/ratings/${encodeURIComponent(sn())}/pdf`);
      previewBlobModal({ title: `Dossier: ${sn()}`, blob, mimeType, fileName: fileName || `CIRERMS_Dossier_${sn()}.pdf` });
    } catch (err) {
      toast(err.message || 'Could not make the dossier.', 'error');
    }
  }

  async function removeRating() {
    const r = state.rating;
    const ok = await confirmDialog({
      title: 'Delete Rating',
      message: `Delete ${r.service_number} (${personName(r)})? This removes the record, its ten tabs and its documents, and cannot be undone.`,
      confirmLabel: 'Delete Rating',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/ratings/${encodeURIComponent(r.service_number)}`);
      toast(`Rating ${r.service_number} deleted.`);
      navigate(r.status === 'former' ? '#ratings/former' : '#ratings/current');
    } catch (err) {
      toast(err.message || 'Could not delete the rating.', 'error');
    }
  }

  const back = readOnly
    ? pageHeader({ title: 'My Details', subtitle: 'Your service record' })
    : h('a', { href: state.rating.status === 'former' ? '#ratings/former' : '#ratings/current', className: 'mb-3 inline-flex items-center gap-1 text-sm text-secondary hover:underline phone:hidden' }, [
        icon('chevron-left'),
        state.rating.status === 'former' ? 'Former Ratings' : 'Current Ratings',
      ]);

  fill(outlet, [back, head, tabs.el, body]);
  drawHead();
  drawBody();
  return () => { if (docs) docs.destroy(); };
}

export async function mountRatingRecord(outlet, { params = {}, query = {} } = {}) {
  outlet.replaceChildren(loadingNode());
  try {
    // the lists are read afresh each time a record opens: a value made inactive meanwhile is still offered
    const [lookups, res, discipline] = await Promise.all([
      getLookups({ force: true }),
      api.get(`/api/ratings/${encodeURIComponent(params.serviceNumber)}`),
      can('disciplinary.concluded', 'view') ? api.get(`/api/disciplinary/rating/${encodeURIComponent(params.serviceNumber)}/cases`).catch(() => null) : null,
    ]);
    return recordView(outlet, { data: res.data, readOnly: false, lookups, initialTab: query.tab, disciplineCount: discipline ? discipline.meta.total : null });
  } catch (err) {
    fill(outlet, h('div', { className: CARD }, emptyState({
      icon: 'search',
      title: err.status === 404 ? 'Rating Not Found' : 'Could Not Load the Rating',
      text: err.message || '',
      action: button({ label: 'Back to List', icon: 'chevron-left', variant: 'outline', href: '#ratings/current' }),
    })));
    return null;
  }
}

export async function mountMyDetails(outlet, { query = {} } = {}) {
  outlet.replaceChildren(loadingNode());
  try {
    const [lookups, res] = await Promise.all([getLookups({ force: true }), api.get('/api/ratings/me')]);
    const me = res.data;
    if (!me.linked) {
      fill(outlet, [
        pageHeader({ title: 'My Details', subtitle: 'Your service record' }),
        h('div', { className: cx(CARD, 'max-w-2xl') }, emptyState({
          icon: 'user-round',
          title: 'No Service Record Linked to This Account',
          text: me.serviceNumber
            ? `This account is linked to ${me.serviceNumber}, which is not in the personnel records.`
            : 'This is an administrative account, so it has no personal service record. Open a rating from the Current or Former lists to see theirs.',
          action: can('ratings.list') ? button({ label: 'Current Ratings', icon: 'users', variant: 'outline', href: '#ratings/current' }) : null,
        })),
      ]);
      return null;
    }
    return recordView(outlet, { data: me, readOnly: true, lookups, initialTab: query.tab });
  } catch (err) {
    fill(outlet, h('div', { className: CARD }, emptyState({ icon: 'circle-alert', title: 'Could Not Load Your Details', text: err.message || '' })));
    return null;
  }
}
