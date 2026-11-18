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
 */

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
      { key: 'drafting', label: 'Drafting', short: 'Drafting', icon: 'briefcase', soon: true },
      { key: 'special-drafting', label: 'Special Drafting', short: 'Special', icon: 'anchor', soon: true },
      { key: 'training-drafting', label: 'Training Drafting', short: 'Training', icon: 'graduation-cap', soon: true },
    ],
  },
  {
    key: 'records',
    label: 'Records',
    modules: [
      { key: 'advancement', label: 'Advancement Processing', short: 'Advance', icon: 'trending-up', soon: true },
      { key: 'assessment', label: 'Naval Character Assessment', short: 'Assess', icon: 'clipboard-check', soon: true },
      { key: 'disciplinary', label: 'Disciplinary Action', short: 'Discipline', icon: 'gavel', soon: true },
      { key: 'discharge', label: 'Discharge Administration', short: 'Discharge', icon: 'door-open', soon: true },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    modules: [
      { key: 'tables', label: 'Static Tables', short: 'Tables', icon: 'database', soon: true },
      { key: 'reports', label: 'Reports', short: 'Reports', icon: 'chart-column', soon: true },
      { key: 'admin', label: 'System Administration', short: 'Admin', icon: 'shield-user', soon: true },
    ],
  },
];

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
 *   screen    the screen id (module.screen), later the permission key
 */
export const PAGES = [
  { pattern: 'dashboard', module: 'dashboard', title: 'Dashboard', subtitle: 'Ratings at a glance', short: 'Home', screen: 'dashboard.home' },
  { pattern: 'ratings/current', module: 'ratings', tab: 'ratings/current', title: 'Current Ratings', subtitle: 'Serving ratings on the nominal roll', screen: 'ratings.list' },
  { pattern: 'ratings/former', module: 'ratings', tab: 'ratings/former', title: 'Former Ratings', subtitle: 'Retired and discharged ratings', screen: 'ratings.list' },
  { pattern: 'ratings/new', module: 'ratings', tab: 'ratings/current', title: 'New Rating', subtitle: 'Add a rating to the nominal roll', back: 'ratings/current', screen: 'ratings.new' },
  {
    pattern: 'ratings/edit/:serviceNumber',
    module: 'ratings',
    tab: 'ratings/current',
    title: (p) => `Rating ${p.serviceNumber}`,
    short: (p) => p.serviceNumber,
    subtitle: 'The rating’s service record',
    back: 'ratings/current',
    screen: 'ratings.edit',
  },
  { pattern: 'ratings/upload', module: 'ratings', tab: 'ratings/upload', title: 'Batch Upload', subtitle: 'Add many ratings from one workbook', screen: 'ratings.upload' },
  { pattern: 'ratings/documents', module: 'ratings', tab: 'ratings/documents', title: 'Documents', subtitle: 'Navpers files by service number', short: 'Documents', screen: 'ratings.documents' },
  {
    pattern: 'ratings/documents/:serviceNumber',
    module: 'ratings',
    tab: 'ratings/documents',
    title: 'Documents',
    subtitle: 'Navpers files by service number',
    short: 'Documents',
    screen: 'ratings.documents',
  },
  { pattern: 'ratings/my-details', module: 'ratings', tab: 'ratings/my-details', title: 'My Details', subtitle: 'Your service record', short: 'My Details', screen: 'ratings.my-details' },
  {
    pattern: 'soon/:key',
    module: (p) => p.key,
    title: (p) => (findModule(p.key) || { label: 'Module' }).label,
    screen: 'soon',
  },
];

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
