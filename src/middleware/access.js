'use strict';

/*
 * Privileges, checked on every route. A privilege is one action on one screen: the screen id
 * from public/js/core/nav.js and view, add, edit, delete or approve. Each module declares its
 * privileges in its manifest (src/modules/<module>/<module>.module.js), and every route of a
 * module that is not public must carry one of these checks (the module loader refuses to
 * start otherwise). They run after requireAuth.
 *
 *   requirePrivilege('ratings.edit', 'edit')
 *   requireAnyPrivilege([['ratings.list', 'view'], ['ratings.documents', 'view']])
 *   requirePrivilege('ratings.edit', 'view', { own: isOwnRecord })
 *       also lets the request through when own(req) is true (a rating reading their own record)
 *
 * Missing the grant: 403 FORBIDDEN in the app's error shape. req.can(screen, action) answers
 * the same question inside a handler.
 */
const { forbidden, unauthorized } = require('../shared/errors');

const ACTIONS = Object.freeze(['view', 'add', 'edit', 'delete', 'approve']);

function can(user, screen, action) {
  return !!(user && user.privileges && user.privileges.has(`${screen}:${action}`));
}

function checkRule(rule) {
  const [screen, action] = rule;
  if (typeof screen !== 'string' || !/^[a-z0-9-]+\.[a-z0-9.-]+$/.test(screen)) {
    throw new Error(`Privilege screen "${screen}" must be a screen id (module.screen).`);
  }
  if (!ACTIONS.includes(action)) {
    throw new Error(`Privilege action "${action}" must be one of ${ACTIONS.join(', ')}.`);
  }
  return [screen, action];
}

function requireAnyPrivilege(rules, { own = null } = {}) {
  const list = rules.map(checkRule);
  const middleware = function privilegeMiddleware(req, _res, next) {
    if (!req.user) return next(unauthorized());
    req.can = (screen, action) => can(req.user, screen, action);
    if (list.some(([screen, action]) => can(req.user, screen, action))) return next();
    if (typeof own === 'function') {
      return Promise.resolve()
        .then(() => own(req))
        .then((ok) => next(ok ? undefined : forbidden('You do not have permission to do this.')))
        .catch(next);
    }
    return next(forbidden('You do not have permission to do this.'));
  };
  // read by the module loader to prove every route is guarded
  middleware.privileges = list;
  return middleware;
}

function requirePrivilege(screen, action, options = {}) {
  return requireAnyPrivilege([[screen, action]], options);
}

module.exports = {
  ACTIONS,
  can,
  requirePrivilege,
  requireAnyPrivilege,
};
