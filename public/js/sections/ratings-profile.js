import { api } from '../core/api.js';
import {
  clear,
  clearFieldErrors,
  confirmModal,
  el,
  formatBytes,
  populateSelect,
  previewBlobModal,
  showFieldErrors,
  showToast,
} from '../core/dom.js';
import { formatDisplayDate, toInputDate } from '../core/dates.js';
import { filterDenominations, filterLgas, getLookups } from '../core/lookups.js';
import { navigate } from '../core/router.js';

const TABS = [
  { key: 'personal', label: 'Ratings Details', progress: 10 },
  { key: 'next-of-kin', label: 'Next of Kin', progress: 20, bundleKey: 'nextOfKin' },
  { key: 'spouse', label: 'Spouse', progress: 30, bundleKey: 'spouse' },
  { key: 'children', label: 'Children', progress: 40, bundleKey: 'children' },
  { key: 'advancement', label: 'Advancement', progress: 50, bundleKey: 'advancement', hasPdf: true, docCategory: 'CERTIFICATE' },
  { key: 'drafting', label: 'Drafting', progress: 60, bundleKey: 'drafting', hasPdf: true, docCategory: 'DRAFTING' },
  { key: 'training', label: 'Training', progress: 70, bundleKey: 'training', hasPdf: true, docCategory: 'CERTIFICATE' },
  { key: 'education', label: 'Education', progress: 80, bundleKey: 'education', hasPdf: true, docCategory: 'CERTIFICATE' },
  { key: 'language', label: 'Language Fluency', progress: 90, bundleKey: 'language' },
  { key: 'documents', label: 'View Document/Upload', progress: 100, bundleKey: 'documents' },
];

export async function mountRatingsProfile(outlet, { mode = 'create', params = {} }) {
  const lookups = await getLookups();

  const unlinkedBox = outlet.querySelector('#my-details-unlinked');
  const unlinkedMsg = outlet.querySelector('#my-details-unlinked-msg');
  const profileCard = outlet.querySelector('#profile-card');
  const modeBadge = outlet.querySelector('#profile-mode-badge');
  const lockHint = outlet.querySelector('#profile-lock-hint');
  const printDossierBtn = outlet.querySelector('#profile-print-dossier-btn');
  const tabsBar = outlet.querySelector('#profile-tabs-bar');
  const progressFill = outlet.querySelector('#profile-progress-fill');
  const bannerTitle = outlet.querySelector('#profile-banner-title');
  const shipBadge = outlet.querySelector('#profile-ship-badge');

  const tabPanePersonal = outlet.querySelector('#tab-pane-personal');
  const tabPaneChild = outlet.querySelector('#tab-pane-child');
  const tabPaneDocuments = outlet.querySelector('#tab-pane-documents');

  const personalForm = outlet.querySelector('#personal-info-form');
  const substepPrevBtn = outlet.querySelector('#substep-prev-btn');
  const substepNextBtn = outlet.querySelector('#substep-next-btn');
  const savePersonalBtn = outlet.querySelector('#save-personal-btn');
  const deleteRatingBtn = outlet.querySelector('#delete-rating-btn');
  const passportImg = outlet.querySelector('#passport-photo-img');
  const passportPlaceholder = outlet.querySelector('#passport-photo-placeholder');
  const passportControls = outlet.querySelector('#passport-upload-controls');
  const passportFileInput = outlet.querySelector('#passport-file-input');
  const passportChooseBtn = outlet.querySelector('#passport-choose-btn');
  const currentShipDisplay = outlet.querySelector('#official-current-ship-display');

  const state = {
    mode, // 'create' | 'edit' | 'readonly'
    activeTab: 'personal',
    activeSubstep: 1,
    docCategoryFilter: 'ALL',
    rating: null,
    children: {
      nextOfKin: [],
      spouse: [],
      children: [],
      advancement: [],
      drafting: [],
      training: [],
      education: [],
      language: [],
      documents: [],
    },
  };

  const isReadOnly = () => state.mode === 'readonly';
  const isLocked = () => state.mode === 'create' && !state.rating?.service_number;

  // ==========================================================================
  // Populate Personal Info Dropdowns & Cascading Selects
  // ==========================================================================
  const selectMappings = [
    ['rate_id', lookups.rates],
    ['title_id', lookups.titles],
    ['gender_id', lookups.genders],
    ['marital_status_id', lookups.maritalStatuses],
    ['religion_id', lookups.religions],
    ['tribe_id', lookups.tribes],
    ['state_id', lookups.states],
    ['geo_political_zone_id', lookups.geoPoliticalZones],
    ['mother_base_id', lookups.motherBases],
    ['identification_type_id', lookups.identificationTypes],
    ['blood_group_id', lookups.bloodGroups],
    ['blood_genotype_id', lookups.bloodGenotypes],
    ['hair_color_id', lookups.hairColors],
    ['eye_color_id', lookups.eyeColors],
    ['complexion_id', lookups.complexions],
    ['disability_id', lookups.disabilities],
    ['branch_id', lookups.branches],
    ['command_id', lookups.commands],
    ['staff_branch_id', lookups.staffBranches],
    ['specialisation_id', lookups.specialisations],
    ['entry_mode_id', lookups.entryModes],
    ['exit_type_id', lookups.exitTypes],
  ];

  for (const [name, list] of selectMappings) {
    populateSelect(personalForm.elements[name], list || []);
  }

  function refreshDenominationSelect(selectedVal = '') {
    const relId = personalForm.elements.religion_id.value;
    const items = filterDenominations(lookups, relId);
    populateSelect(personalForm.elements.religion_denomination_id, items, {
      placeholder: relId ? '-- Select Denomination --' : '-- Select Religion First --',
      selectedValue: selectedVal,
    });
  }

  function refreshLgaSelect(selectedVal = '') {
    const stId = personalForm.elements.state_id.value;
    const items = filterLgas(lookups, stId);
    populateSelect(personalForm.elements.local_government_id, items, {
      placeholder: stId ? '-- Select Local Government --' : '-- Select State First --',
      selectedValue: selectedVal,
    });
  }

  personalForm.elements.religion_id.addEventListener('change', () => refreshDenominationSelect(''));
  personalForm.elements.state_id.addEventListener('change', () => refreshLgaSelect(''));
  refreshDenominationSelect('');
  refreshLgaSelect('');

  // ==========================================================================
  // Header, Tabs & Sub-step Synchronisation
  // ==========================================================================
  function syncHeaderAndTabs() {
    if (state.mode === 'readonly') {
      modeBadge.textContent = 'Read-Only Personal Service Record';
    } else if (isLocked()) {
      modeBadge.textContent = 'New Rating Registration';
    } else {
      modeBadge.textContent = `Editing Dossier: ${state.rating.service_number}`;
    }

    lockHint.classList.toggle('hidden', !isLocked());
    printDossierBtn.classList.toggle('hidden', !state.rating?.service_number);
    deleteRatingBtn.classList.toggle('hidden', isReadOnly() || isLocked());
    savePersonalBtn.classList.toggle('hidden', isReadOnly());
    passportControls.classList.toggle('hidden', isReadOnly());

    if (state.rating) {
      const r = state.rating;
      const nameStr = [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
      bannerTitle.textContent = `Ratings Information of ${r.rate_name ? `${r.rate_name} ` : ''}${nameStr} (${r.service_number})`;
      if (r.current_ship_name) {
        shipBadge.textContent = `Current Ship: ${r.current_ship_name}`;
        shipBadge.classList.remove('hidden');
      } else {
        shipBadge.classList.add('hidden');
      }
      currentShipDisplay.value = r.current_ship_name || 'No active open Drafting record';
    } else {
      bannerTitle.textContent = 'New Rating Registration — Complete Personal Details';
      shipBadge.classList.add('hidden');
      currentShipDisplay.value = 'Assigned via Drafting tab after saving';
    }

    // Render 10-Tab Strip with padlock icons
    clear(tabsBar);
    for (const tab of TABS) {
      const active = state.activeTab === tab.key;
      const locked = tab.key !== 'personal' && isLocked();

      const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lockSvg.setAttribute('viewBox', '0 0 20 20');
      lockSvg.setAttribute('fill', 'currentColor');
      lockSvg.setAttribute('class', `w-3.5 h-3.5 mx-auto mb-1 ${active ? 'text-cirerms-ink' : 'text-gray-500'}`);
      const pathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      if (locked) {
        pathNode.setAttribute('fill-rule', 'evenodd');
        pathNode.setAttribute('clip-rule', 'evenodd');
        pathNode.setAttribute('d', 'M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z');
      } else {
        pathNode.setAttribute('d', 'M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z');
      }
      lockSvg.appendChild(pathNode);

      const btn = el(
        'button',
        {
          type: 'button',
          className: [
            'px-2 py-3 text-center border-r border-b lg:border-b-0 border-cirerms-border transition flex flex-col items-center justify-center leading-tight',
            active
              ? 'bg-white text-cirerms-ink font-semibold shadow-sm'
              : locked
                ? 'bg-cirerms-tab-idle text-gray-400 cursor-not-allowed'
                : 'bg-cirerms-tab-idle text-gray-600 hover:bg-gray-200/70 hover:text-cirerms-ink',
          ].join(' '),
          onClick: () => {
            if (locked) {
              showToast('Save Personal Details first to unlock this tab.', 'info');
              return;
            }
            switchTab(tab.key);
          },
        },
        [lockSvg, el('span', { text: tab.label })]
      );
      tabsBar.appendChild(btn);
    }

    // Update progress bar
    const tabSpec = TABS.find((t) => t.key === state.activeTab) || TABS[0];
    let pct = tabSpec.progress;
    if (state.activeTab === 'personal') {
      pct = state.activeSubstep * 2.5 + 2.5; // 5%, 7.5%, 10%, 12.5%
    }
    progressFill.style.width = `${pct}%`;
  }

  function syncSubsteps() {
    outlet.querySelectorAll('[data-substep]').forEach((btn) => {
      const stepNum = Number(btn.dataset.substep);
      const isActive = stepNum === state.activeSubstep;
      btn.classList.toggle('bg-white', isActive);
      btn.classList.toggle('text-cirerms-ink', isActive);
      btn.classList.toggle('font-semibold', isActive);
      btn.classList.toggle('bg-cirerms-tab-idle', !isActive);
      btn.classList.toggle('text-gray-600', !isActive);
    });

    outlet.querySelectorAll('[data-substep-pane]').forEach((pane) => {
      const stepNum = Number(pane.dataset.substepPane);
      pane.classList.toggle('hidden', stepNum !== state.activeSubstep);
    });

    substepPrevBtn.disabled = state.activeSubstep <= 1;
    substepPrevBtn.classList.toggle('opacity-50', state.activeSubstep <= 1);
    substepNextBtn.disabled = state.activeSubstep >= 4;
    substepNextBtn.classList.toggle('opacity-50', state.activeSubstep >= 4);

    if (state.activeTab === 'personal') {
      progressFill.style.width = `${state.activeSubstep * 2.5 + 2.5}%`;
    }
  }

  outlet.querySelectorAll('[data-substep]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeSubstep = Number(btn.dataset.substep) || 1;
      syncSubsteps();
    });
  });

  substepPrevBtn.addEventListener('click', () => {
    if (state.activeSubstep > 1) {
      state.activeSubstep -= 1;
      syncSubsteps();
    }
  });

  substepNextBtn.addEventListener('click', () => {
    if (state.activeSubstep < 4) {
      state.activeSubstep += 1;
      syncSubsteps();
    }
  });

  function populatePersonalFormFromState() {
    const r = state.rating;
    if (!r) return;

    const directFields = [
      'service_number',
      'status',
      'rate_id',
      'title_id',
      'surname',
      'first_name',
      'middle_name',
      'maiden_name',
      'gender_id',
      'marital_status_id',
      'married_to_military_personnel',
      'religion_id',
      'tribe_id',
      'state_id',
      'geo_political_zone_id',
      'place_of_birth',
      'mother_base_id',
      'phone',
      'email_address',
      'identification_type_id',
      'identity_number',
      'driver_license_number',
      'home_address',
      'weight_kg',
      'height_m',
      'chest_cm',
      'tribal_mark',
      'blood_group_id',
      'blood_genotype_id',
      'hair_color_id',
      'eye_color_id',
      'complexion_id',
      'disability_id',
      'disability_comment',
      'branch_id',
      'command_id',
      'staff_branch_id',
      'specialisation_id',
      'entry_mode_id',
      'hobbies',
      'exit_type_id',
      'exit_reason',
    ];

    for (const key of directFields) {
      const ctrl = personalForm.elements[key];
      if (!ctrl) continue;
      ctrl.value = r[key] == null ? '' : String(r[key]);
    }

    // Cascading selects after religion_id & state_id are populated
    refreshDenominationSelect(r.religion_denomination_id ?? '');
    refreshLgaSelect(r.local_government_id ?? '');

    // Date inputs (never 0001-01-01)
    const dateCols = [
      'date_of_birth',
      'driver_license_expiry_date',
      'date_employed',
      'seniority_date',
      'exit_date',
    ];
    for (const dc of dateCols) {
      const ctrl = personalForm.elements[dc];
      if (ctrl) ctrl.value = toInputDate(r[dc]);
    }

    api.loadAuthImage(passportImg, r.passport_photo_url, passportPlaceholder);

    if (isReadOnly()) {
      Array.from(personalForm.elements).forEach((input) => {
        if (input.tagName === 'INPUT' || input.tagName === 'SELECT' || input.tagName === 'TEXTAREA') {
          input.disabled = true;
        }
      });
    }
  }

  // ==========================================================================
  // Save / Delete Personal Details & Upload Passport Photo
  // ==========================================================================
  personalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isReadOnly()) return;
    clearFieldErrors(personalForm);

    const fd = new FormData(personalForm);
    const payload = {};
    for (const [k, v] of fd.entries()) {
      payload[k] = typeof v === 'string' ? v.trim() : v;
    }

    savePersonalBtn.disabled = true;
    savePersonalBtn.textContent = 'Saving...';

    try {
      let res;
      if (isLocked()) {
        res = await api.post('/api/ratings', payload);
        state.mode = 'edit';
        state.rating = res.data.rating;
        state.children = res.data.children;
        showToast(`Rating ${state.rating.service_number} created. All tabs are now unlocked.`, 'success');
        window.history.replaceState(null, '', `#ratings/edit/${encodeURIComponent(state.rating.service_number)}`);
      } else {
        const prevSn = state.rating.service_number;
        res = await api.put(`/api/ratings/${encodeURIComponent(prevSn)}`, payload);
        state.rating = res.data.rating;
        state.children = res.data.children;
        showToast('Personal details saved successfully.', 'success');
        if (state.rating.service_number !== prevSn) {
          window.history.replaceState(null, '', `#ratings/edit/${encodeURIComponent(state.rating.service_number)}`);
        }
      }
      populatePersonalFormFromState();
      syncHeaderAndTabs();
    } catch (err) {
      if (err.fields) {
        // Jump to the sub-step containing the first invalid input so the error is visible
        const firstErrField = Object.keys(err.fields)[0];
        if (firstErrField) {
          const errInput = personalForm.querySelector(`[name="${CSS.escape(firstErrField)}"]`);
          const pane = errInput?.closest('[data-substep-pane]');
          if (pane) {
            state.activeSubstep = Number(pane.dataset.substepPane) || 1;
            syncSubsteps();
          }
        }
        showFieldErrors(personalForm, err.fields);
      }
      showToast(err.message || 'Could not save Personal Details.', 'error');
    } finally {
      savePersonalBtn.disabled = false;
      savePersonalBtn.textContent = 'Save Personal Details';
    }
  });

  deleteRatingBtn.addEventListener('click', async () => {
    if (!state.rating?.service_number) return;
    const sn = state.rating.service_number;
    const ok = await confirmModal({
      title: `Delete Rating ${sn}`,
      message: `Permanently delete ${sn} (${state.rating.full_name}) and all associated family, advancement, drafting, training, education, and document records?`,
      confirmLabel: 'Delete Rating',
      danger: true,
    });
    if (!ok) return;

    try {
      const targetList = state.rating.status === 'former' ? '#ratings/former' : '#ratings/current';
      await api.del(`/api/ratings/${encodeURIComponent(sn)}`);
      showToast(`Rating ${sn} deleted.`, 'success');
      navigate(targetList);
    } catch (err) {
      showToast(err.message || 'Failed to delete rating.', 'error');
    }
  });

  passportChooseBtn.addEventListener('click', () => {
    if (isLocked()) {
      showToast('Save Personal Details first before uploading a passport photograph.', 'info');
      return;
    }
    passportFileInput.click();
  });

  passportFileInput.addEventListener('change', async () => {
    const file = passportFileInput.files?.[0];
    if (!file || !state.rating?.service_number) return;

    const fd = new FormData();
    fd.append('photo', file);
    passportChooseBtn.disabled = true;
    passportChooseBtn.textContent = 'Uploading...';

    try {
      const res = await api.upload(
        `/api/ratings/${encodeURIComponent(state.rating.service_number)}/photo/passport`,
        fd
      );
      state.rating = res.data.rating;
      await api.loadAuthImage(passportImg, state.rating.passport_photo_url, passportPlaceholder);
      showToast('Passport photograph updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Photograph upload failed.', 'error');
    } finally {
      passportFileInput.value = '';
      passportChooseBtn.disabled = false;
      passportChooseBtn.textContent = 'Upload Passport Photo';
    }
  });

  printDossierBtn.addEventListener('click', async () => {
    if (!state.rating?.service_number) return;
    try {
      const sn = state.rating.service_number;
      const { blob, mimeType, fileName } = await api.fetchBlob(`/api/ratings/${encodeURIComponent(sn)}/pdf`);
      previewBlobModal({
        title: `Full Personnel Dossier — ${sn}`,
        blob,
        mimeType,
        fileName: fileName || `CIRERMS_Dossier_${sn}.pdf`,
      });
    } catch (err) {
      showToast(err.message || 'Failed to generate dossier PDF.', 'error');
    }
  });

  // ==========================================================================
  // Child Tab Specifications (Tabs 2–9)
  // ==========================================================================
  const CHILD_UI_SPECS = {
    'next-of-kin': {
      addTitle: 'Add Next of Kin',
      bundleKey: 'nextOfKin',
      hasNokPhoto: true,
      fields: [
        { name: 'first_name', label: 'First Name *', type: 'text', required: true },
        { name: 'last_name', label: 'Last Name *', type: 'text', required: true },
        { name: 'mobile_number', label: 'Mobile Number', type: 'tel' },
        { name: 'next_of_kin_type_id', label: 'Next Of Kin Type', type: 'select', options: lookups.nextOfKinTypes },
      ],
      columns: [
        { label: 'First Name', value: (r) => r.first_name },
        { label: 'Last Name', value: (r) => r.last_name },
        { label: 'Mobile Number', value: (r) => r.mobile_number || '-' },
        { label: 'Next Of Kin Type', value: (r) => r.next_of_kin_type_name || '-' },
      ],
    },
    spouse: {
      addTitle: 'Add Spouse',
      bundleKey: 'spouse',
      fields: [
        { name: 'name', label: 'Spouse Full Name *', type: 'text', required: true },
        { name: 'phone_number', label: 'Phone Number', type: 'tel' },
        { name: 'email_address', label: 'Email Address', type: 'email' },
      ],
      columns: [
        { label: 'Name', value: (r) => r.name },
        { label: 'Phone Number', value: (r) => r.phone_number || '-' },
        { label: 'Email Address', value: (r) => r.email_address || '-' },
      ],
    },
    children: {
      addTitle: 'Add Child',
      bundleKey: 'children',
      fields: [
        { name: 'name', label: 'Child Full Name *', type: 'text', required: true },
        { name: 'phone_number', label: 'Phone Number', type: 'tel' },
        { name: 'email_address', label: 'Email Address', type: 'email' },
      ],
      columns: [
        { label: 'Name', value: (r) => r.name },
        { label: 'Phone Number', value: (r) => r.phone_number || '-' },
        { label: 'Email Address', value: (r) => r.email_address || '-' },
      ],
    },
    advancement: {
      addTitle: 'Add Advancement',
      bundleKey: 'advancement',
      hasPdf: true,
      docCategory: 'CERTIFICATE',
      fields: [
        { name: 'rate_id', label: 'Rate *', type: 'select', options: lookups.rates, required: true },
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' },
        { name: 'decoration', label: 'Decoration', type: 'text' },
        { name: 'authority', label: 'Authority', type: 'text' },
        { name: 'gcbno', label: 'GCBNO', type: 'text' },
      ],
      columns: [
        { label: 'Start Date', value: (r) => formatDisplayDate(r.start_date) || '-' },
        { label: 'End Date', value: (r) => formatDisplayDate(r.end_date) || 'Present' },
        { label: 'Rate', value: (r) => r.rate_name || '-' },
        { label: 'Decoration', value: (r) => r.decoration || '-' },
        { label: 'Authority', value: (r) => r.authority || '-' },
        { label: 'GCBNO', value: (r) => r.gcbno || '-' },
      ],
    },
    drafting: {
      addTitle: 'Add Drafting',
      bundleKey: 'drafting',
      hasPdf: true,
      docCategory: 'DRAFTING',
      fields: [
        { name: 'ship_id', label: 'Ship / Unit *', type: 'select', options: lookups.ships, required: true },
        { name: 'rate_id', label: 'Rate at Posting', type: 'select', options: lookups.rates },
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date (Leave blank if Current Ship)', type: 'date' },
        { name: 'remarks', label: 'Remarks', type: 'text' },
      ],
      columns: [
        { label: 'Ship / Unit', value: (r) => r.ship_name || '-' },
        { label: 'Rate', value: (r) => r.rate_name || '-' },
        { label: 'Start Date', value: (r) => formatDisplayDate(r.start_date) || '-' },
        { label: 'End Date', value: (r) => (r.end_date ? formatDisplayDate(r.end_date) : 'Present (Current Ship)') },
        { label: 'Remarks', value: (r) => r.remarks || '-' },
      ],
    },
    training: {
      addTitle: 'Add Training',
      bundleKey: 'training',
      hasPdf: true,
      docCategory: 'CERTIFICATE',
      fields: [
        { name: 'institution', label: 'Institution *', type: 'text', required: true },
        { name: 'qualification', label: 'Qualification', type: 'text' },
        { name: 'classification', label: 'Class / Grade', type: 'text' },
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' },
      ],
      columns: [
        { label: 'Name', value: (r) => r.rating_name || state.rating?.full_name || '-' },
        { label: 'Institution', value: (r) => r.institution },
        { label: 'Qualification', value: (r) => r.qualification || '-' },
        { label: 'Class', value: (r) => r.classification || '-' },
        { label: 'Start Date', value: (r) => formatDisplayDate(r.start_date) || '-' },
        { label: 'End Date', value: (r) => formatDisplayDate(r.end_date) || '-' },
      ],
    },
    education: {
      addTitle: 'Add Education',
      bundleKey: 'education',
      hasPdf: true,
      docCategory: 'CERTIFICATE',
      fields: [
        { name: 'institution', label: 'Institution *', type: 'text', required: true },
        { name: 'qualification', label: 'Qualification', type: 'text' },
        { name: 'classification', label: 'Class / Grade', type: 'text' },
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' },
      ],
      columns: [
        { label: 'Institution', value: (r) => r.institution },
        { label: 'Qualification', value: (r) => r.qualification || '-' },
        { label: 'Class', value: (r) => r.classification || '-' },
        { label: 'Start Date', value: (r) => formatDisplayDate(r.start_date) || '-' },
        { label: 'End Date', value: (r) => formatDisplayDate(r.end_date) || '-' },
      ],
    },
    language: {
      addTitle: 'Add Language Fluency',
      bundleKey: 'language',
      fields: [
        { name: 'language_id', label: 'Language *', type: 'select', options: lookups.languages, required: true },
        { name: 'can_read', label: 'Can Read', type: 'boolean' },
        { name: 'can_write', label: 'Can Write', type: 'boolean' },
        { name: 'can_speak', label: 'Can Speak', type: 'boolean' },
      ],
      columns: [
        { label: 'Name', value: (r) => r.rating_name || state.rating?.full_name || '-' },
        { label: 'Language', value: (r) => r.language_name || '-' },
        { label: 'Read', value: (r) => (r.can_read ? 'Yes' : 'No') },
        { label: 'Write', value: (r) => (r.can_write ? 'Yes' : 'No') },
        { label: 'Speak', value: (r) => (r.can_speak ? 'Yes' : 'No') },
      ],
    },
  };

  function renderChildTab(tabKey) {
    clear(tabPaneChild);
    const spec = CHILD_UI_SPECS[tabKey];
    if (!spec || !state.rating) return;

    const sn = state.rating.service_number;
    const rows = state.children[spec.bundleKey] || [];
    let editingRowId = null;

    // Optional Next-of-Kin Photo Box on Next of Kin tab
    if (spec.hasNokPhoto) {
      const nokImg = el('img', { alt: 'Next of Kin Photograph', className: 'hidden w-full h-full object-cover' });
      const nokPlaceholder = el('div', { className: 'text-[11px] text-gray-400 px-2 text-center', text: 'No Next of Kin photo' });
      const nokInput = el('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp', className: 'hidden' });
      const nokBtn = el('button', {
        type: 'button',
        className: 'cirerms-btn-blue text-xs',
        text: 'Upload Next of Kin Photo',
        onClick: () => nokInput.click(),
      });

      nokInput.addEventListener('change', async () => {
        const file = nokInput.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('photo', file);
        nokBtn.disabled = true;
        try {
          const res = await api.upload(`/api/ratings/${encodeURIComponent(sn)}/photo/next-of-kin`, fd);
          state.rating = res.data.rating;
          await api.loadAuthImage(nokImg, state.rating.next_of_kin_photo_url, nokPlaceholder);
          showToast('Next of Kin photograph updated.', 'success');
        } catch (err) {
          showToast(err.message || 'Failed to upload Next of Kin photo.', 'error');
        } finally {
          nokInput.value = '';
          nokBtn.disabled = false;
        }
      });

      api.loadAuthImage(nokImg, state.rating.next_of_kin_photo_url, nokPlaceholder);

      tabPaneChild.appendChild(
        el('div', { className: 'rounded border border-cirerms-border bg-gray-50/70 p-4 flex flex-wrap items-center gap-4' }, [
          el('div', { className: 'w-24 h-28 rounded border border-gray-300 bg-white flex items-center justify-center overflow-hidden shrink-0' }, [
            nokImg,
            nokPlaceholder,
          ]),
          el('div', { className: 'space-y-1.5' }, [
            el('div', { className: 'text-xs font-semibold text-cirerms-ink', text: 'Next of Kin Passport Photograph' }),
            el('p', { className: 'text-xs text-gray-500', text: 'Official Next of Kin identification photograph on file.' }),
            !isReadOnly() ? nokInput : null,
            !isReadOnly() ? nokBtn : null,
          ]),
        ])
      );
    }

    // Collapsible Add/Edit Panel (hidden in readonly mode)
    let formEl = null;
    let formTitleEl = null;
    let formBodyWrapper = null;
    let submitRecordBtn = null;
    let cancelEditBtn = null;

    if (!isReadOnly()) {
      formTitleEl = el('h3', { className: 'text-sm font-medium text-cirerms-ink', text: spec.addTitle });
      const toggleSymbol = el('span', { className: 'text-lg font-normal text-gray-500 leading-none', text: '−' });

      formBodyWrapper = el('div', { className: 'pt-4 mt-3 border-t border-gray-100' });
      formEl = el('form', { className: 'space-y-4', novalidate: true });

      const fieldsGrid = el('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4' });
      for (const f of spec.fields) {
        let control;
        if (f.type === 'select') {
          control = el('select', { name: f.name, className: 'cirerms-input' });
          populateSelect(control, f.options || []);
        } else if (f.type === 'boolean') {
          control = el('select', { name: f.name, className: 'cirerms-input' }, [
            el('option', { value: '0', text: 'No' }),
            el('option', { value: '1', text: 'Yes' }),
          ]);
        } else {
          control = el('input', {
            name: f.name,
            type: f.type || 'text',
            className: 'cirerms-input',
            required: Boolean(f.required),
          });
        }
        fieldsGrid.appendChild(
          el('div', {}, [
            el('label', { className: 'cirerms-label', text: f.label }),
            control,
          ])
        );
      }

      submitRecordBtn = el('button', {
        type: 'submit',
        className: 'cirerms-btn-teal text-xs px-5 py-2',
        text: 'Save Record',
      });
      cancelEditBtn = el('button', {
        type: 'button',
        className: 'hidden rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50',
        text: 'Cancel Edit',
        onClick: () => {
          editingRowId = null;
          formEl.reset();
          clearFieldErrors(formEl);
          formTitleEl.textContent = spec.addTitle;
          submitRecordBtn.textContent = 'Save Record';
          cancelEditBtn.classList.add('hidden');
        },
      });

      formEl.appendChild(fieldsGrid);
      formEl.appendChild(el('div', { className: 'flex items-center gap-2' }, [submitRecordBtn, cancelEditBtn]));
      formBodyWrapper.appendChild(formEl);

      const headerToggle = el(
        'div',
        {
          className: 'flex items-center justify-between cursor-pointer select-none',
          onClick: () => {
            const collapsed = formBodyWrapper.classList.toggle('hidden');
            toggleSymbol.textContent = collapsed ? '+' : '−';
          },
        },
        [formTitleEl, toggleSymbol]
      );

      tabPaneChild.appendChild(
        el('div', { className: 'rounded border border-gray-200 bg-white p-4 shadow-sm' }, [
          headerToggle,
          formBodyWrapper,
        ])
      );

      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors(formEl);
        const fd = new FormData(formEl);
        const body = {};
        for (const [k, v] of fd.entries()) {
          body[k] = typeof v === 'string' ? v.trim() : v;
        }

        submitRecordBtn.disabled = true;
        try {
          let res;
          if (editingRowId) {
            res = await api.put(`/api/ratings/${encodeURIComponent(sn)}/records/${tabKey}/${editingRowId}`, body);
            showToast('Record updated.', 'success');
          } else {
            res = await api.post(`/api/ratings/${encodeURIComponent(sn)}/records/${tabKey}`, body);
            showToast('Record added.', 'success');
          }
          state.children[spec.bundleKey] = res.data.items || [];
          if (tabKey === 'drafting') {
            state.rating.current_ship_name = res.data.currentShipName || null;
            syncHeaderAndTabs();
          }
          renderChildTab(tabKey);
        } catch (err) {
          if (err.fields) showFieldErrors(formEl, err.fields);
          showToast(err.message || 'Could not save record.', 'error');
          submitRecordBtn.disabled = false;
        }
      });
    }

    // Toolbar above table (Generate PDF + View Document on Advancement, Drafting, Training, Education)
    const toolbarRight = el('div', { className: 'flex flex-wrap items-center gap-2' });
    if (spec.hasPdf) {
      toolbarRight.appendChild(
        el('button', {
          type: 'button',
          className: 'cirerms-btn-teal text-xs',
          text: 'Generate PDF',
          onClick: async () => {
            try {
              const url = `/api/ratings/${encodeURIComponent(sn)}/tabs/${tabKey}/pdf`;
              const { blob, mimeType, fileName } = await api.fetchBlob(url);
              previewBlobModal({
                title: `${sn} — ${tabKey.toUpperCase()} Report`,
                blob,
                mimeType,
                fileName: fileName || `CIRERMS_${sn}_${tabKey}.pdf`,
              });
            } catch (err) {
              showToast(err.message || 'Failed to generate PDF.', 'error');
            }
          },
        })
      );

      toolbarRight.appendChild(
        el('button', {
          type: 'button',
          className: 'cirerms-btn-teal text-xs',
          text: 'View Document',
          onClick: () => {
            state.docCategoryFilter = spec.docCategory || 'ALL';
            switchTab('documents');
          },
        })
      );
    }

    tabPaneChild.appendChild(
      el('div', { className: 'flex flex-wrap items-center justify-between gap-2' }, [
        el('div', { className: 'text-xs text-gray-600', text: `Total Entries: ${rows.length}` }),
        toolbarRight,
      ])
    );

    // Records Table
    const theadTr = el('tr', { className: 'border-b border-gray-300 text-xs font-bold text-cirerms-ink bg-gray-50/70' }, [
      el('th', { className: 'py-2.5 px-3', text: 'SN' }),
      ...spec.columns.map((c) => el('th', { className: 'py-2.5 px-3', text: c.label })),
      !isReadOnly() ? el('th', { className: 'py-2.5 px-3', text: 'Action' }) : null,
    ]);

    const tbody = el('tbody', { className: 'divide-y divide-gray-100 text-sm text-gray-700' });
    if (rows.length === 0) {
      tbody.appendChild(
        el('tr', {}, [
          el('td', {
            colSpan: spec.columns.length + (isReadOnly() ? 1 : 2),
            className: 'py-6 px-3 text-center text-xs text-gray-500',
            text: 'No data available in table',
          }),
        ])
      );
    } else {
      rows.forEach((row, idx) => {
        const tr = el('tr', { className: 'hover:bg-gray-50' }, [
          el('td', { className: 'py-2.5 px-3 text-xs', text: String(idx + 1) }),
          ...spec.columns.map((c) => el('td', { className: 'py-2.5 px-3 text-xs', text: String(c.value(row) ?? '-') })),
        ]);

        if (!isReadOnly()) {
          tr.appendChild(
            el('td', { className: 'py-2 px-3 whitespace-nowrap' }, [
              el('div', { className: 'inline-flex items-center gap-1.5' }, [
                el('button', {
                  type: 'button',
                  className: 'cirerms-btn-blue text-xs px-2.5 py-1',
                  text: 'Edit',
                  onClick: () => {
                    editingRowId = row.id;
                    formBodyWrapper.classList.remove('hidden');
                    formTitleEl.textContent = `Edit Record #${idx + 1}`;
                    submitRecordBtn.textContent = 'Update Record';
                    cancelEditBtn.classList.remove('hidden');
                    for (const f of spec.fields) {
                      const ctrl = formEl.elements[f.name];
                      if (!ctrl) continue;
                      if (f.type === 'date') ctrl.value = toInputDate(row[f.name]);
                      else if (f.type === 'boolean') ctrl.value = row[f.name] ? '1' : '0';
                      else ctrl.value = row[f.name] == null ? '' : String(row[f.name]);
                    }
                    formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  },
                }),
                el('button', {
                  type: 'button',
                  className: 'cirerms-btn-danger text-xs px-2.5 py-1',
                  text: 'Delete',
                  onClick: async () => {
                    const ok = await confirmModal({
                      title: 'Delete Record',
                      message: 'Are you sure you want to delete this record?',
                      confirmLabel: 'Delete',
                      danger: true,
                    });
                    if (!ok) return;
                    try {
                      const res = await api.del(`/api/ratings/${encodeURIComponent(sn)}/records/${tabKey}/${row.id}`);
                      state.children[spec.bundleKey] = res.data.items || [];
                      if (tabKey === 'drafting') {
                        state.rating.current_ship_name = res.data.currentShipName || null;
                        syncHeaderAndTabs();
                      }
                      renderChildTab(tabKey);
                      showToast('Record deleted.', 'success');
                    } catch (err) {
                      showToast(err.message || 'Delete failed.', 'error');
                    }
                  },
                }),
              ]),
            ])
          );
        }
        tbody.appendChild(tr);
      });
    }

    tabPaneChild.appendChild(
      el('div', { className: 'rounded border border-cirerms-border overflow-x-auto cirerms-scroll' }, [
        el('table', { className: 'w-full text-left border-collapse' }, [
          el('thead', {}, [theadTr]),
          tbody,
        ]),
      ])
    );
  }

  // ==========================================================================
  // Tab 10: View Document / Upload (matches Screenshot 161432)
  // ==========================================================================
  async function renderDocumentsTab() {
    clear(tabPaneDocuments);
    if (!state.rating) return;

    const sn = state.rating.service_number;
    const categories = lookups.documentCategories || [];

    // Fetch latest decorated documents bundle
    try {
      const res = await api.get(`/api/ratings/${encodeURIComponent(sn)}/documents`);
      state.children.documents = res.data.documents || [];
    } catch (err) {
      showToast(err.message || 'Failed to load rating documents.', 'error');
    }

    const docs = state.children.documents || [];

    tabPaneDocuments.appendChild(
      el('div', { className: 'rounded border border-gray-200 bg-white p-4 shadow-sm' }, [
        el('h3', { className: 'text-base font-normal text-cirerms-ink', text: 'View and Upload Rating Documents' }),
        el('p', { className: 'text-xs text-gray-500 mt-0.5', text: 'Filter by Navpers document category or upload new scanned certificates and forms.' }),
      ])
    );

    // Teal Category Filter Buttons (matching Screenshot 161432)
    const pillsRow = el('div', { className: 'flex flex-wrap gap-2' });
    const pillItems = [
      { code: 'ALL', label: 'ALL DOCUMENTS' },
      ...categories.map((c) => ({ code: c.code, label: `VIEW ${c.name.toUpperCase()} DOC` })),
    ];
    for (const p of pillItems) {
      const selected = state.docCategoryFilter === p.code;
      pillsRow.appendChild(
        el('button', {
          type: 'button',
          className: selected
            ? 'rounded bg-cirerms-sidebar px-3.5 py-2 text-xs font-semibold text-white shadow-sm'
            : 'rounded bg-cirerms-teal hover:bg-cirerms-teal-hover px-3.5 py-2 text-xs font-medium text-white shadow-sm transition',
          text: p.label,
          onClick: () => {
            state.docCategoryFilter = p.code;
            renderDocumentsTab();
          },
        })
      );
    }
    tabPaneDocuments.appendChild(pillsRow);

    // Upload Form (hidden in readonly mode)
    if (!isReadOnly()) {
      const fileInput = el('input', {
        type: 'file',
        name: 'document',
        accept: '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx',
        className: 'text-xs text-gray-700 file:mr-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-100',
      });
      const catSelect = el('select', { name: 'category_id', className: 'cirerms-input w-64 uppercase' });
      populateSelect(catSelect, categories, { placeholder: null, valueKey: 'id', labelKey: 'name' });
      if (state.docCategoryFilter !== 'ALL') {
        const matchCat = categories.find((c) => c.code === state.docCategoryFilter);
        if (matchCat) catSelect.value = String(matchCat.id);
      }

      const uploadBtn = el('button', { type: 'submit', className: 'cirerms-btn-teal', text: 'Upload' });
      const uploadForm = el(
        'form',
        {
          className: 'flex flex-wrap items-center gap-3',
          onSubmit: async (e) => {
            e.preventDefault();
            const f = fileInput.files?.[0];
            if (!f) {
              showToast('Please choose a file before clicking Upload.', 'error');
              return;
            }
            const fd = new FormData();
            fd.append('document', f);
            fd.append('category_id', catSelect.value);
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            try {
              await api.upload(`/api/ratings/${encodeURIComponent(sn)}/documents`, fd);
              showToast('Document uploaded.', 'success');
              await renderDocumentsTab();
            } catch (err) {
              showToast(err.message || 'Upload failed.', 'error');
              uploadBtn.disabled = false;
              uploadBtn.textContent = 'Upload';
            }
          },
        },
        [fileInput, catSelect, uploadBtn]
      );

      tabPaneDocuments.appendChild(
        el('div', { className: 'pt-2 space-y-2.5' }, [
          el('h4', { className: 'text-lg font-normal text-gray-600', text: 'Document Personnel Upload' }),
          uploadForm,
        ])
      );
    }

    // Documents Table
    const visibleDocs = state.docCategoryFilter === 'ALL'
      ? docs
      : docs.filter((d) => d.category_code === state.docCategoryFilter);

    const tbody = el('tbody', { className: 'divide-y divide-gray-100 text-sm text-gray-700' });
    if (visibleDocs.length === 0) {
      tbody.appendChild(
        el('tr', {}, [
          el('td', {
            colSpan: 6,
            className: 'py-8 px-3 text-center text-xs text-gray-500',
            text: 'No documents uploaded under the selected category.',
          }),
        ])
      );
    } else {
      visibleDocs.forEach((doc, idx) => {
        tbody.appendChild(
          el('tr', { className: 'hover:bg-gray-50' }, [
            el('td', { className: 'py-2.5 px-3 text-xs', text: String(idx + 1) }),
            el('td', { className: 'py-2.5 px-3 text-xs font-medium text-cirerms-ink', text: doc.original_name }),
            el('td', { className: 'py-2.5 px-3 text-xs', text: doc.category_name }),
            el('td', { className: 'py-2.5 px-3 text-xs text-gray-500', text: formatBytes(doc.size_bytes) }),
            el('td', { className: 'py-2.5 px-3 text-xs text-gray-500', text: formatDisplayDate(doc.created_at) || '-' }),
            el('td', { className: 'py-2 px-3 whitespace-nowrap' }, [
              el('div', { className: 'inline-flex items-center gap-1.5' }, [
                el('button', {
                  type: 'button',
                  className: 'cirerms-btn-teal text-xs px-2.5 py-1',
                  text: 'View',
                  onClick: async () => {
                    try {
                      const { blob, mimeType, fileName } = await api.fetchBlob(doc.view_url);
                      previewBlobModal({
                        title: `${doc.category_name} — ${doc.original_name}`,
                        blob,
                        mimeType,
                        fileName: fileName || doc.original_name,
                      });
                    } catch (err) {
                      showToast(err.message || 'Preview failed.', 'error');
                    }
                  },
                }),
                el('button', {
                  type: 'button',
                  className: 'cirerms-btn-blue text-xs px-2.5 py-1',
                  text: 'Download',
                  onClick: () => api.downloadFile(doc.download_url, doc.original_name),
                }),
                !isReadOnly()
                  ? el('button', {
                      type: 'button',
                      className: 'cirerms-btn-danger text-xs px-2.5 py-1',
                      text: 'Delete',
                      onClick: async () => {
                        const ok = await confirmModal({
                          title: 'Delete Document',
                          message: `Delete "${doc.original_name}"?`,
                          confirmLabel: 'Delete',
                          danger: true,
                        });
                        if (!ok) return;
                        try {
                          await api.del(`/api/ratings/${encodeURIComponent(sn)}/documents/${doc.id}`);
                          showToast('Document deleted.', 'success');
                          await renderDocumentsTab();
                        } catch (err) {
                          showToast(err.message || 'Delete failed.', 'error');
                        }
                      },
                    })
                  : null,
              ]),
            ]),
          ])
        );
      });
    }

    tabPaneDocuments.appendChild(
      el('div', { className: 'rounded border border-cirerms-border overflow-x-auto cirerms-scroll' }, [
        el('table', { className: 'w-full text-left border-collapse' }, [
          el('thead', {}, [
            el('tr', { className: 'border-b border-gray-300 text-xs font-bold text-cirerms-ink bg-gray-50/70' }, [
              el('th', { className: 'py-2.5 px-3', text: 'SN' }),
              el('th', { className: 'py-2.5 px-3', text: 'Document Name' }),
              el('th', { className: 'py-2.5 px-3', text: 'Category' }),
              el('th', { className: 'py-2.5 px-3', text: 'Size' }),
              el('th', { className: 'py-2.5 px-3', text: 'Uploaded' }),
              el('th', { className: 'py-2.5 px-3', text: 'Action' }),
            ]),
          ]),
          tbody,
        ]),
      ])
    );
  }

  function switchTab(tabKey) {
    state.activeTab = tabKey;
    syncHeaderAndTabs();

    tabPanePersonal.classList.toggle('hidden', tabKey !== 'personal');
    tabPaneChild.classList.toggle('hidden', tabKey === 'personal' || tabKey === 'documents');
    tabPaneDocuments.classList.toggle('hidden', tabKey !== 'documents');

    if (tabKey === 'personal') {
      syncSubsteps();
    } else if (tabKey === 'documents') {
      renderDocumentsTab();
    } else {
      renderChildTab(tabKey);
    }
  }

  // ==========================================================================
  // Initial Load for Mode ('create' vs 'edit' vs 'readonly')
  // ==========================================================================
  if (state.mode === 'readonly') {
    const res = await api.get('/api/ratings/me');
    if (!res.data.linked) {
      profileCard.classList.add('hidden');
      unlinkedMsg.textContent = res.data.message;
      unlinkedBox.classList.remove('hidden');
      return;
    }
    state.rating = res.data.rating;
    state.children = res.data.children;
    populatePersonalFormFromState();
  } else if (state.mode === 'edit') {
    const res = await api.get(`/api/ratings/${encodeURIComponent(params.serviceNumber)}`);
    state.rating = res.data.rating;
    state.children = res.data.children;
    populatePersonalFormFromState();
  }

  syncHeaderAndTabs();
  syncSubsteps();
}
