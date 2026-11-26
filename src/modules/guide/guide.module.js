'use strict';

// The User Guide: the chapters in docs/manual, cut on the server to what the signed-in person may use.
// Public in the module loader's sense (it holds no privilege of its own): every route signs the person in
// itself (requireAuth, as Change Password's do) and cuts what it sends to the person's own privileges.
module.exports = {
  key: 'guide',
  label: 'User Guide',
  basePath: '/api/guide',
  routes: './guide.routes',
  public: true,
  privileges: [],
};
