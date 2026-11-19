'use strict';

// Sign in, sign out, the session and its lock. Public: its routes check the session themselves.
module.exports = {
  key: 'auth',
  basePath: '/api/auth',
  routes: './auth.routes',
  public: true,
  privileges: [],
};
