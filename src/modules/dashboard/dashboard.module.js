'use strict';

module.exports = {
  key: 'dashboard',
  label: 'Dashboard',
  basePath: '/api/dashboard',
  routes: './dashboard.routes',
  privileges: [
    { screen: 'dashboard.home', label: 'Dashboard', actions: ['view'] },
  ],
};
