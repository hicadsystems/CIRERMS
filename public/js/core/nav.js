/*
 * Navigation catalogue: the one list of areas, modules, each module's tabs and
 * every page the router knows. The desktop rail, the module tabs, the phone
 * header, bottom bar and More sheet, the router and (later) the Ctrl K search
 * all read it, so a new screen is added here once.
 *
 *   AREAS     areas in rail order, each with its modules
 *   MODULES   every module, flat, with `href` (its first page, or soon/<key>)
 *   PAGES     every route pattern with its title, module, tab and screen id
 *   BOTTOM    the phone's bottom bar
 *
 * A module marked `soon` has no screens yet: it opens #soon/<key>, the
 * "Coming in a Later Release" page.
 *
 * Adding a module's screens: its pages here (with `screen` and `view`), its tabs in AREAS,
 * and its section files in js/sections/. The shell loads each page's `view` itself and checks
 * the person's privileges (core/access.js) for `screen` and `action`; nothing else is edited.
 */

/*
 * The 16 Static Tables, in the demo's order: the route tables/<slug>, the tab's label, the page title
 * and the privilege screen tables.<slug>. The same slugs and labels are in
 * src/modules/tables/tables.config.js (the columns and rules live there).
 */
export const TABLES = [
  { slug: 'appraisal-ratings', tab: 'Appraisal Ratings', title: 'Appraisal Ratings' },
  { slug: 'branch', tab: 'Branch', title: 'Branches' },
  { slug: 'exit-type', tab: 'Exit Type', title: 'Exit Types' },
  { slug: 'entry-mode', tab: 'Entry Mode', title: 'Entry Modes' },
  { slug: 'offences', tab: 'Offences', title: 'Disciplinary Offences' },
  { slug: 'sanctions', tab: 'Sanctions', title: 'Disciplinary Sanctions' },
  { slug: 'institution', tab: 'Institution', title: 'Institutions' },
  { slug: 'local-government', tab: 'Local Government', title: 'Local Governments' },
  { slug: 'languages', tab: 'Languages', title: 'Languages' },
  { slug: 'relationship', tab: 'Relationship', title: 'Relationships' },
  { slug: 'staff-branch', tab: 'Staff Branch', title: 'Staff Branches' },
  { slug: 'specialisation', tab: 'Specialisation Area', title: 'Specialisation Areas' },
  { slug: 'ships', tab: 'Ships', title: 'Ships and Bases' },
  { slug: 'states', tab: 'States', title: 'States' },
  { slug: 'title', tab: 'Title', title: 'Titles' },
  { slug: 'training', tab: 'Training', title: 'Training Courses' },
];

export const AREAS = [
  {
    key: 'overview',
    label: 'Overview',
    modules: [
      { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'layout-dashboard', href: 'dashboard', tabs: [] },
    ],
  },
  {
    key: 'personnel',
    label: 'Personnel',
    modules: [
      {
        key: 'ratings',
        label: 'Ratings Management',
        short: 'Ratings',
        icon: 'users',
        href: 'ratings/current',
        // New Rating is a button on the lists, not a tab
        tabs: [
          { route: 'ratings/current', label: 'Current', icon: 'users', screen: 'ratings.list' },
          { route: 'ratings/former', label: 'Former', icon: 'history', screen: 'ratings.list' },
          { route: 'ratings/upload', label: 'Batch Upload', icon: 'file-up', screen: 'ratings.upload' },
          { route: 'ratings/documents', label: 'Documents', icon: 'folder-open', screen: 'ratings.documents' },
          { route: 'ratings/my-details', label: 'My Details', icon: 'user-round', screen: 'ratings.my-details' },
        ],
      },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    modules: [
      {
        key: 'drafting',
        label: 'Drafting',
        short: 'Drafting',
        icon: 'briefcase',
        href: 'drafting/manning',
        // the draft cycle (WP7a) and its three reports (WP7b)
        tabs: [
          { route: 'drafting/manning', label: 'Update Manning Requirement', icon: 'ship', screen: 'drafting.manning' },
          { route: 'drafting/proposal', label: 'Print Draft Proposal', icon: 'users', screen: 'drafting.proposal' },
          { route: 'drafting/review', label: 'Review/Print Draft', icon: 'list', screen: 'drafting.review' },
          { route: 'drafting/approval', label: 'Draft Approval', icon: 'shield-check', screen: 'drafting.approval' },
          { route: 'drafting/close', label: 'Close Draft', icon: 'lock', screen: 'drafting.close' },
          { route: 'drafting/wef', label: 'Update WEF', icon: 'calendar', screen: 'drafting.wef' },
          { route: 'drafting/batches', label: 'Batch/Signal Content', icon: 'file-text', screen: 'drafting.batches' },
          { route: 'drafting/history', label: 'Rate DOD History', icon: 'history', screen: 'drafting.history' },
          { route: 'drafting/report', label: 'Draft Report', icon: 'clipboard-check', screen: 'drafting.report' },
        ],
      },
      {
        key: 'special-drafting',
        label: 'Special Drafting',
        short: 'Special',
        icon: 'anchor',
        href: 'special-drafting/proposal',
        // special drafts outside the batch cycle (WP11)
        tabs: [
          { route: 'special-drafting/proposal', label: 'Special Draft Proposal', icon: 'users', screen: 'special-drafting.proposal' },
          { route: 'special-drafting/report', label: 'Special Draft Report', icon: 'file-text', screen: 'special-drafting.report' },
          { route: 'special-drafting/upload', label: 'Upload Draft', icon: 'file-up', screen: 'special-drafting.upload' },
        ],
      },
      {
        key: 'training-drafting',
        label: 'Training Drafting',
        short: 'Training',
        icon: 'graduation-cap',
        href: 'training/process',
        // the training draft (WP6)
        tabs: [
          { route: 'training/process', label: 'Process Training Draft', icon: 'graduation-cap', screen: 'training.process' },
          { route: 'training/review', label: 'Training Review', icon: 'list', screen: 'training.review' },
          { route: 'training/history', label: 'Update Training History', icon: 'history', screen: 'training.history' },
          { route: 'training/reports', label: 'Reports', icon: 'file-text', screen: 'training.reports' },
          { route: 'training/upload', label: 'Excel Upload', icon: 'file-up', screen: 'training.upload' },
        ],
      },
    ],
  },
  {
    key: 'records',
    label: 'Records',
    modules: [
      {
        key: 'advancement',
        label: 'Advancement Processing',
        short: 'Advance',
        icon: 'trending-up',
        href: 'advancement/due',
        // the advancement cycle (WP8)
        tabs: [
          { route: 'advancement/due', label: 'Rates due for Advancement', icon: 'users', screen: 'advancement.due' },
          { route: 'advancement/review', label: 'Advancement Review', icon: 'list', screen: 'advancement.review' },
          { route: 'advancement/approval', label: 'Approval', icon: 'shield-check', screen: 'advancement.approval' },
          { route: 'advancement/close', label: 'Close', icon: 'lock', screen: 'advancement.close' },
          { route: 'advancement/board', label: 'Board Returns Update', icon: 'calendar', screen: 'advancement.board' },
          { route: 'advancement/promoted', label: 'Report on Promoted Rates', icon: 'file-text', screen: 'advancement.promoted' },
          { route: 'advancement/upload', label: 'Upload Advanced Rates', icon: 'file-up', screen: 'advancement.upload' },
        ],
      },
      {
        key: 'assessment',
        label: 'Naval Character Assessment',
        short: 'Assess',
        icon: 'clipboard-check',
        href: 'assessment/grading',
        // appraisals (WP12)
        tabs: [
          { route: 'assessment/grading', label: 'Recommendation and Grading', icon: 'clipboard-check', screen: 'appraisal.grading' },
          { route: 'assessment/report', label: 'Report on Appraisal', icon: 'file-text', screen: 'appraisal.report' },
          { route: 'assessment/periods', label: 'Appraisal Periods', icon: 'calendar', screen: 'appraisal.periods' },
        ],
      },
      {
        key: 'disciplinary',
        label: 'Disciplinary Action',
        short: 'Discipline',
        icon: 'gavel',
        href: 'disciplinary/initiate',
        tabs: [
          { route: 'disciplinary/initiate', label: 'Initiate Incident', icon: 'gavel', screen: 'disciplinary.initiate' },
          { route: 'disciplinary/pending', label: 'Pending Cases', icon: 'list', screen: 'disciplinary.pending' },
          { route: 'disciplinary/concluded', label: 'Concluded Cases', icon: 'circle-check', screen: 'disciplinary.concluded' },
          { route: 'disciplinary/report', label: 'Disciplinary Report', icon: 'file-text', screen: 'disciplinary.report' },
        ],
      },
      {
        key: 'discharge',
        label: 'Discharge Administration',
        short: 'Discharge',
        icon: 'door-open',
        href: 'discharge/process',
        tabs: [
          { route: 'discharge/process', label: 'Process Discharge', icon: 'door-open', screen: 'discharge.process' },
          { route: 'discharge/service', label: 'Print Service Details', icon: 'printer', screen: 'discharge.service' },
          { route: 'discharge/forms', label: 'Verification Forms', icon: 'clipboard-check', screen: 'discharge.forms' },
          { route: 'discharge/report', label: 'Discharge Report', icon: 'chart-column', screen: 'discharge.report' },
          { route: 'discharge/upload', label: 'Upload Discharge', icon: 'upload', screen: 'discharge.upload' },
        ],
      },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    modules: [
      // one tab and page per table (TABLES below); each is its own privilege, screen tables.<slug>
      { key: 'tables', label: 'Static Tables', short: 'Tables', icon: 'database', href: 'tables/appraisal-ratings', tabs: [] },
      {
        key: 'reports',
        label: 'Reports',
        short: 'Reports',
        icon: 'chart-column',
        href: 'reports/ship-history',
        // read-only reports (WP9)
        tabs: [
          { route: 'reports/ship-history', label: 'Ship History', icon: 'ship', screen: 'reports.ship-history' },
          { route: 'reports/all-personnel', label: 'All Personnel', icon: 'users', screen: 'reports.all-personnel' },
          { route: 'reports/disposition', label: 'Disposition', icon: 'anchor', screen: 'reports.disposition' },
          { route: 'reports/nominal-roll', label: 'Nominal Roll', icon: 'list', screen: 'reports.nominal-roll' },
          { route: 'reports/manning-state', label: 'Manning State', icon: 'clipboard-check', screen: 'reports.manning-state' },
          { route: 'reports/retirement-forecast', label: 'Retirement Forecast', icon: 'calendar', screen: 'reports.retirement-forecast' },
        ],
      },
      {
        key: 'admin',
        label: 'System Administration',
        short: 'Admin',
        icon: 'shield-user',
        href: 'admin/users',
        tabs: [
          { route: 'admin/users', label: 'Manage Users', icon: 'users', screen: 'admin.users' },
          { route: 'admin/roles', label: 'Manage Roles', icon: 'shield-user', screen: 'admin.roles' },
          { route: 'admin/password', label: 'Manage Password', icon: 'key-round', screen: 'admin.password' },
          { route: 'admin/audit', label: 'Audit Trail', icon: 'history', screen: 'admin.audit' },
        ],
      },
    ],
  },
];

// the Static Tables module's tabs, one per table
AREAS.flatMap((a) => a.modules).find((m) => m.key === 'tables').tabs = TABLES.map((t) => ({ route: `tables/${t.slug}`, label: t.tab, screen: `tables.${t.slug}` }));

export const MODULES = AREAS.flatMap((area) =>
  area.modules.map((m) => ({ tabs: [], ...m, area: area.key, href: m.href || `soon/${m.key}` }))
);

export function findModule(key) {
  return MODULES.find((m) => m.key === key) || null;
}

/*
 * Every route. `pattern` segments starting with ':' are parameters.
 *   module    the module highlighted in the rail
 *   tab       the module tab highlighted (a record or form keeps its list's tab)
 *   title     page title (string, or a function of the params)
 *   subtitle  one line under the title (hidden on phones)
 *   short     the phone header's title (defaults to the module's short name)
 *   back      a route: the phone header shows a back arrow to it instead of the crest
 *   screen    the screen id (module.screen): the privilege key, with `action`
 *   action    the privilege needed to open the page (default 'view')
 *   open      true: every signed-in person may open the page, whatever their role (the User Guide)
 *   view      { file, mount, props }: the section file in js/sections/, the function it
 *             exports to draw the page (mount(outlet, { params, query, info, ...props })),
 *             and extra options for it. The shell imports it when the page opens.
 */
export const PAGES = [
  { pattern: 'dashboard', module: 'dashboard', title: 'Dashboard', subtitle: 'Ratings at a glance', short: 'Home', screen: 'dashboard.home', view: { file: 'dashboard.js', mount: 'mountDashboard' } },
  { pattern: 'ratings/current', module: 'ratings', tab: 'ratings/current', title: 'Current Ratings', subtitle: 'Serving ratings on the nominal roll', screen: 'ratings.list', view: { file: 'ratings-list.js', mount: 'mountRatingsList', props: { status: 'current' } } },
  { pattern: 'ratings/former', module: 'ratings', tab: 'ratings/former', title: 'Former Ratings', subtitle: 'Retired and discharged ratings', screen: 'ratings.list', view: { file: 'ratings-list.js', mount: 'mountRatingsList', props: { status: 'former' } } },
  // the New Rating dialog over the current list (the list's header: infoFrom)
  { pattern: 'ratings/new', module: 'ratings', tab: 'ratings/current', title: 'New Rating', subtitle: 'Serving ratings on the nominal roll', screen: 'ratings.new', action: 'add', view: { file: 'ratings-list.js', mount: 'mountRatingsList', props: { status: 'current', openNew: true, infoFrom: 'ratings/current' } } },
  {
    pattern: 'ratings/edit/:serviceNumber',
    module: 'ratings',
    tab: 'ratings/current',
    title: (p) => `Rating ${p.serviceNumber}`,
    short: (p) => p.serviceNumber,
    subtitle: 'The rating’s service record',
    back: 'ratings/current',
    screen: 'ratings.edit',
    view: { file: 'rating-record.js', mount: 'mountRatingRecord' },
  },
  { pattern: 'ratings/upload', module: 'ratings', tab: 'ratings/upload', title: 'Batch Upload', subtitle: 'Add many ratings from one workbook', screen: 'ratings.upload', view: { file: 'ratings-upload.js', mount: 'mountRatingsUpload' } },
  { pattern: 'ratings/documents', module: 'ratings', tab: 'ratings/documents', title: 'Documents', subtitle: 'Navpers files by service number', short: 'Documents', screen: 'ratings.documents', view: { file: 'ratings-documents.js', mount: 'mountRatingsDocuments' } },
  {
    pattern: 'ratings/documents/:serviceNumber',
    module: 'ratings',
    tab: 'ratings/documents',
    title: 'Documents',
    subtitle: 'Navpers files by service number',
    short: 'Documents',
    screen: 'ratings.documents',
    view: { file: 'ratings-documents.js', mount: 'mountRatingsDocuments' },
  },
  { pattern: 'ratings/my-details', module: 'ratings', tab: 'ratings/my-details', title: 'My Details', subtitle: 'Your service record', short: 'My Details', screen: 'ratings.my-details', view: { file: 'rating-record.js', mount: 'mountMyDetails' } },
  // the User Guide: open to every signed-in person (`open`); the server cuts what it sends to their privileges
  { pattern: 'guide', title: 'User Guide', subtitle: 'How to use CIRERMS', short: 'User Guide', screen: 'guide', open: true, view: { file: 'guide.js', mount: 'mountGuide' } },
  { pattern: 'guide/:section', title: 'User Guide', subtitle: 'How to use CIRERMS', short: 'User Guide', screen: 'guide', open: true, view: { file: 'guide.js', mount: 'mountGuide' } },
  // Drafting (WP7a): the draft cycle, each page needs view
  { pattern: 'drafting/manning', module: 'drafting', tab: 'drafting/manning', title: 'Update Manning Requirement', subtitle: 'What each ship or unit needs, and who is aboard now. It advises; it never blocks a draft', short: 'Manning', screen: 'drafting.manning', view: { file: 'drafting.js', mount: 'mountManning' } },
  { pattern: 'drafting/proposal', module: 'drafting', tab: 'drafting/proposal', title: 'Print Draft Proposal', subtitle: 'Ratings due for a draft; make a batch of them for review', short: 'Draft Proposal', screen: 'drafting.proposal', view: { file: 'drafting.js', mount: 'mountProposal' } },
  { pattern: 'drafting/review', module: 'drafting', tab: 'drafting/review', title: 'Review/Print Draft', subtitle: 'Choose where each rating is drafted to', short: 'Review Draft', screen: 'drafting.review', view: { file: 'drafting.js', mount: 'mountReview' } },
  { pattern: 'drafting/approval', module: 'drafting', tab: 'drafting/approval', title: 'Draft Approval', subtitle: 'Approve each department\u2019s draft before its batch is closed', short: 'Draft Approval', screen: 'drafting.approval', view: { file: 'drafting.js', mount: 'mountApproval' } },
  { pattern: 'drafting/close', module: 'drafting', tab: 'drafting/close', title: 'Close Draft', subtitle: 'Close a reviewed and approved draft with its authority', short: 'Close Draft', screen: 'drafting.close', view: { file: 'drafting.js', mount: 'mountClose' } },
  { pattern: 'drafting/wef', module: 'drafting', tab: 'drafting/wef', title: 'Update WEF', subtitle: 'Date each posting: the rating moves to the new ship from that date', short: 'Update WEF', screen: 'drafting.wef', view: { file: 'drafting.js', mount: 'mountWef' } },
  // Drafting reports (WP7b): read-only, each page needs view
  { pattern: 'drafting/batches', module: 'drafting', tab: 'drafting/batches', title: 'Batch/Signal Content', subtitle: 'Every draft batch, its authority and how many have reported', short: 'Batches', screen: 'drafting.batches', view: { file: 'drafting-reports.js', mount: 'mountBatches' } },
  { pattern: 'drafting/batches/:id', module: 'drafting', tab: 'drafting/batches', title: 'Batch Contents', subtitle: 'The ratings in one draft batch', short: 'Batch', back: 'drafting/batches', screen: 'drafting.batches', view: { file: 'drafting-reports.js', mount: 'mountBatchContent' } },
  { pattern: 'drafting/history', module: 'drafting', tab: 'drafting/history', title: 'Rate DOD History', subtitle: 'Every draft a rating has been through', short: 'DOD History', screen: 'drafting.history', view: { file: 'drafting-reports.js', mount: 'mountHistory' } },
  { pattern: 'drafting/report', module: 'drafting', tab: 'drafting/report', title: 'Draft Report', subtitle: 'Every posting that has reported, by WEF', short: 'Draft Report', screen: 'drafting.report', view: { file: 'drafting-reports.js', mount: 'mountDraftReport' } },
  // Advancement Processing (WP8): the advancement cycle, each page needs view
  { pattern: 'advancement/due', module: 'advancement', tab: 'advancement/due', title: 'Rates due for Advancement', subtitle: 'Ratings due for the next rate; make a batch of them for review', short: 'Rates Due', screen: 'advancement.due', view: { file: 'advancement.js', mount: 'mountDue' } },
  { pattern: 'advancement/review', module: 'advancement', tab: 'advancement/review', title: 'Advancement Review', subtitle: 'Set each rating\u2019s next rate, or mark it not recommended', short: 'Review', screen: 'advancement.review', view: { file: 'advancement.js', mount: 'mountReview' } },
  { pattern: 'advancement/approval', module: 'advancement', tab: 'advancement/approval', title: 'Approval', subtitle: 'Approve each department\u2019s advancement list before its batch is closed', short: 'Approval', screen: 'advancement.approval', view: { file: 'advancement.js', mount: 'mountApproval' } },
  { pattern: 'advancement/close', module: 'advancement', tab: 'advancement/close', title: 'Close', subtitle: 'Close a reviewed and approved advancement batch with its authority', short: 'Close', screen: 'advancement.close', view: { file: 'advancement.js', mount: 'mountClose' } },
  { pattern: 'advancement/board', module: 'advancement', tab: 'advancement/board', title: 'Board Returns Update', subtitle: 'Enter the date the board approved each advancement', short: 'Board Returns', screen: 'advancement.board', view: { file: 'advancement.js', mount: 'mountBoard' } },
  { pattern: 'advancement/promoted', module: 'advancement', tab: 'advancement/promoted', title: 'Report on Promoted Rates', subtitle: 'Every advancement batch, its authority and how many were promoted', short: 'Promoted Rates', screen: 'advancement.promoted', view: { file: 'advancement.js', mount: 'mountPromoted' } },
  { pattern: 'advancement/promoted/:batchId', module: 'advancement', tab: 'advancement/promoted', title: 'Report on Promoted Rates', subtitle: 'A batch and its ratings', short: 'Batch', back: 'advancement/promoted', screen: 'advancement.promoted', view: { file: 'advancement.js', mount: 'mountPromotedBatch' } },
  { pattern: 'advancement/upload', module: 'advancement', tab: 'advancement/upload', title: 'Upload Advanced Rates', subtitle: 'Load past advancements for ratings from a workbook', short: 'Upload', screen: 'advancement.upload', view: { file: 'advancement.js', mount: 'mountUpload' } },
  // Disciplinary Action (WP4): Initiate Incident needs add; the others need view
  { pattern: 'disciplinary/initiate', module: 'disciplinary', tab: 'disciplinary/initiate', title: 'Initiate Incident', subtitle: 'Open a disciplinary case against a current rating', short: 'Initiate Incident', screen: 'disciplinary.initiate', action: 'add', view: { file: 'disciplinary.js', mount: 'mountInitiate' } },
  { pattern: 'disciplinary/pending', module: 'disciplinary', tab: 'disciplinary/pending', title: 'Pending Cases', subtitle: 'Incidents waiting for a decision', short: 'Pending Cases', screen: 'disciplinary.pending', view: { file: 'disciplinary.js', mount: 'mountPending' } },
  { pattern: 'disciplinary/concluded', module: 'disciplinary', tab: 'disciplinary/concluded', title: 'Concluded Cases', subtitle: 'Cases with a decision; a mistake is changed with Correct', short: 'Concluded Cases', screen: 'disciplinary.concluded', view: { file: 'disciplinary.js', mount: 'mountConcluded' } },
  { pattern: 'disciplinary/report', module: 'disciplinary', tab: 'disciplinary/report', title: 'Disciplinary Report', subtitle: 'Concluded cases by period, offence, sanction, ship and rate', short: 'Disciplinary Report', screen: 'disciplinary.report', view: { file: 'disciplinary.js', mount: 'mountReport' } },
  // Discharge Administration (WP5): five pages
  { pattern: 'discharge/process', module: 'discharge', tab: 'discharge/process', title: 'Process Discharge', subtitle: 'Create proposals and process, close, re-engage or remove ratings', short: 'Process', screen: 'discharge.process', view: { file: 'discharge.js', mount: 'mountProcess' } },
  { pattern: 'discharge/service', module: 'discharge', tab: 'discharge/service', title: 'Print Service Details', subtitle: 'Find a current or former rating and print its personnel details', short: 'Service Details', screen: 'discharge.service', view: { file: 'discharge.js', mount: 'mountService' } },
  { pattern: 'discharge/forms', module: 'discharge', tab: 'discharge/forms', title: 'Verification Forms', subtitle: 'Re-engagement, retirement and engagement verification forms', short: 'Forms', screen: 'discharge.forms', view: { file: 'discharge.js', mount: 'mountForms' } },
  { pattern: 'discharge/report', module: 'discharge', tab: 'discharge/report', title: 'Discharge Report', subtitle: 'Closed discharges and re-engagements by date, exit type, rate and branch', short: 'Report', screen: 'discharge.report', view: { file: 'discharge.js', mount: 'mountReport' } },
  { pattern: 'discharge/upload', module: 'discharge', tab: 'discharge/upload', title: 'Upload Discharge', subtitle: 'Check and import discharge rows from an Excel workbook', short: 'Upload', screen: 'discharge.upload', view: { file: 'discharge.js', mount: 'mountUpload' } },
  // Special Drafting (WP11): special drafts outside the batch cycle, each page needs view
  { pattern: 'special-drafting/proposal', module: 'special-drafting', tab: 'special-drafting/proposal', title: 'Special Draft Proposal', subtitle: 'Draft one rating outside the batch cycle, on a signal’s authority', short: 'Proposal', screen: 'special-drafting.proposal', view: { file: 'special-drafting.js', mount: 'mountProposal' } },
  { pattern: 'special-drafting/report', module: 'special-drafting', tab: 'special-drafting/report', title: 'Special Draft Report', subtitle: 'Print the waiting drafts of a posting type on one form, and the forms already printed', short: 'Report', screen: 'special-drafting.report', view: { file: 'special-drafting.js', mount: 'mountReport' } },
  { pattern: 'special-drafting/upload', module: 'special-drafting', tab: 'special-drafting/upload', title: 'Upload Draft', subtitle: 'Load special drafts for many ratings from a workbook', short: 'Upload', screen: 'special-drafting.upload', view: { file: 'special-drafting.js', mount: 'mountUpload' } },
  // Naval Character Assessment (WP12): each page needs view
  { pattern: 'assessment/grading', module: 'assessment', tab: 'assessment/grading', title: 'Recommendation and Grading', subtitle: 'Character and efficiency grades, one appraisal for each rating and period', short: 'Grading', screen: 'appraisal.grading', view: { file: 'appraisal.js', mount: 'mountGrading' } },
  { pattern: 'assessment/report', module: 'assessment', tab: 'assessment/report', title: 'Report on Appraisal', subtitle: 'The appraisals of a period, with the grade counts', short: 'Report', screen: 'appraisal.report', view: { file: 'appraisal.js', mount: 'mountReport' } },
  { pattern: 'assessment/periods', module: 'assessment', tab: 'assessment/periods', title: 'Appraisal Periods', subtitle: 'The periods appraisals are recorded in', short: 'Periods', screen: 'appraisal.periods', view: { file: 'appraisal.js', mount: 'mountPeriods' } },
  // Training Drafting (WP6): Review and History also open on one batch (training/review/7)
  { pattern: 'training/process', module: 'training-drafting', tab: 'training/process', title: 'Process Training Draft', subtitle: 'The open training batches', short: 'Process Training Draft', screen: 'training.process', view: { file: 'training.js', mount: 'mountProcess' } },
  { pattern: 'training/review', module: 'training-drafting', tab: 'training/review', title: 'Training Review', subtitle: 'The ratings of an open batch', short: 'Training Review', screen: 'training.review', view: { file: 'training.js', mount: 'mountReview' } },
  { pattern: 'training/review/:batchId', module: 'training-drafting', tab: 'training/review', title: 'Training Review', subtitle: 'The ratings of an open batch', short: 'Training Review', screen: 'training.review', view: { file: 'training.js', mount: 'mountReview' } },
  { pattern: 'training/history', module: 'training-drafting', tab: 'training/history', title: 'Update Training History', subtitle: 'Who attended, and confirm the history', short: 'Update Training History', screen: 'training.history', view: { file: 'training.js', mount: 'mountHistory' } },
  { pattern: 'training/history/:batchId', module: 'training-drafting', tab: 'training/history', title: 'Update Training History', subtitle: 'Who attended, and confirm the history', short: 'Update Training History', screen: 'training.history', view: { file: 'training.js', mount: 'mountHistory' } },
  { pattern: 'training/reports', module: 'training-drafting', tab: 'training/reports', title: 'Training Reports', subtitle: 'Batches by training, month, year and number', short: 'Training Reports', screen: 'training.reports', view: { file: 'training.js', mount: 'mountReports' } },
  { pattern: 'training/upload', module: 'training-drafting', tab: 'training/upload', title: 'Training Excel Upload', subtitle: 'Add Training entries to many records from one workbook', short: 'Training Excel Upload', screen: 'training.upload', view: { file: 'training.js', mount: 'mountUpload' } },
 ...TABLES.map((t) => ({
    pattern: `tables/${t.slug}`,
    module: 'tables',
    tab: `tables/${t.slug}`,
    title: t.title,
    subtitle: 'Reference values the other screens pick from',
    short: t.tab,
    screen: `tables.${t.slug}`,
    view: { file: 'static-table.js', mount: 'mountStaticTable', props: { slug: t.slug } },
  })),
  // Reports (WP9): read-only, each page needs view
  { pattern: 'reports/ship-history', module: 'reports', tab: 'reports/ship-history', title: 'Ship History Report', subtitle: 'Ratings posted to a ship over time', short: 'Ship History', screen: 'reports.ship-history', view: { file: 'reports.js', mount: 'mountShipHistory' } },
  { pattern: 'reports/all-personnel', module: 'reports', tab: 'reports/all-personnel', title: 'All Personnel', subtitle: 'The Ratings Report, filtered your way', short: 'All Personnel', screen: 'reports.all-personnel', view: { file: 'reports.js', mount: 'mountAllPersonnel' } },
  { pattern: 'reports/disposition', module: 'reports', tab: 'reports/disposition', title: 'Disposition Report', subtitle: 'Where ratings serve, by ship or unit and rate', short: 'Disposition', screen: 'reports.disposition', view: { file: 'reports.js', mount: 'mountDisposition' } },
  { pattern: 'reports/nominal-roll', module: 'reports', tab: 'reports/nominal-roll', title: 'Nominal Roll', subtitle: 'The ratings serving now on a ship or unit, or on every ship of a command', short: 'Nominal Roll', screen: 'reports.nominal-roll', view: { file: 'reports.js', mount: 'mountNominalRoll' } },
  { pattern: 'reports/manning-state', module: 'reports', tab: 'reports/manning-state', title: 'Manning State', subtitle: 'Every ship\u2019s manning requirement against who is aboard', short: 'Manning State', screen: 'reports.manning-state', view: { file: 'reports.js', mount: 'mountManningState' } },
  { pattern: 'reports/retirement-forecast', module: 'reports', tab: 'reports/retirement-forecast', title: 'Retirement Forecast', subtitle: 'Who becomes due for discharge in the next 6, 12 or 24 months', short: 'Retirement', screen: 'reports.retirement-forecast', view: { file: 'reports.js', mount: 'mountRetirementForecast' } },
  { pattern: 'admin/users', module: 'admin', tab: 'admin/users', title: 'Manage Users', subtitle: 'Accounts that can sign in', short: 'Users', screen: 'admin.users', view: { file: 'admin-users.js', mount: 'mountAdminUsers' } },
  { pattern: 'admin/roles', module: 'admin', tab: 'admin/roles', title: 'Manage Roles', subtitle: 'What each role may open and change', short: 'Roles', screen: 'admin.roles', view: { file: 'admin-roles.js', mount: 'mountAdminRoles' } },
  { pattern: 'admin/password', module: 'admin', tab: 'admin/password', title: 'Manage Password', subtitle: 'Reset a password for someone who cannot sign in', short: 'Password', screen: 'admin.password', view: { file: 'admin-password.js', mount: 'mountAdminPassword' } },
  { pattern: 'admin/audit', module: 'admin', tab: 'admin/audit', title: 'Audit Trail', subtitle: 'Every action and change, newest first', short: 'Audit', screen: 'admin.audit', view: { file: 'admin-audit.js', mount: 'mountAdminAudit' } },
  {
    // "Coming in a Later Release" (drawn by the shell; shown to full-access roles only)
    pattern: 'soon/:key',
    module: (p) => p.key,
    title: (p) => (findModule(p.key) || { label: 'Module' }).label,
    screen: 'soon',
  },
];

// the phone's bottom bar; an item shows when its page may be opened (More always shows)
export const BOTTOM = [
  { key: 'dashboard', label: 'Home', icon: 'house', href: 'dashboard' },
  { key: 'ratings', label: 'Ratings', icon: 'users', href: 'ratings/current' },
  { key: 'documents', label: 'Documents', icon: 'folder-open', href: 'ratings/documents' },
  { key: 'me', label: 'My Details', icon: 'user-round', href: 'ratings/my-details' },
  { key: 'more', label: 'More', icon: 'layout-grid' },
];

/** Splits "#a/b?x=1" into its clean path, segments and query. */
export function parseHash(hash) {
  const clean = String(hash || '').replace(/^#\/?/, '').trim() || 'dashboard';
  const [path, queryPart] = clean.split('?');
  return { path, segments: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(queryPart || '')) };
}

/** Matches one pattern ("ratings/edit/:serviceNumber") against a path: its params, or null. */
export function matchPattern(pattern, path) {
  const segments = String(path || '').split('/').filter(Boolean);
  const parts = pattern.split('/').filter(Boolean);
  if (parts.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(segments[i]);
    else if (parts[i] !== segments[i]) return null;
  }
  return params;
}

/** Matches a route path against PAGES: { page, params } or null. */
export function matchPage(path) {
  for (const page of PAGES) {
    const params = matchPattern(page.pattern, path);
    if (params) return { page, params };
  }
  return null;
}

const resolve = (v, params) => (typeof v === 'function' ? v(params) : v);

/**
 * Everything the shell needs to draw a page: its module, tabs, titles and back link.
 * `path` is the hash path ("ratings/edit/B0539").
 */
export function describe(path) {
  const hit = matchPage(path);
  if (!hit) return null;
  const { page, params } = hit;
  const moduleKey = resolve(page.module, params);
  const mod = findModule(moduleKey);
  const title = resolve(page.title, params);
  return {
    path,
    page,
    params,
    module: mod,
    tabs: mod ? mod.tabs : [],
    tab: page.tab || null,
    title,
    subtitle: resolve(page.subtitle, params) || '',
    short: resolve(page.short, params) || (mod && mod.key !== 'ratings' ? mod.label : mod ? mod.short : title),
    back: page.back || null,
    screen: page.screen,
  };
}

/** Which bottom bar item a page belongs to on a phone. */
export function bottomKeyFor(info) {
  if (!info) return 'more';
  if (info.path === 'dashboard') return 'dashboard';
  if (info.tab === 'ratings/documents') return 'documents';
  if (info.tab === 'ratings/my-details') return 'me';
  if (info.module && info.module.key === 'ratings') return 'ratings';
  return 'more';
}
