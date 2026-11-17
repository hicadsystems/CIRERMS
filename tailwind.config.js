/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.html',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        cirerms: {
          sidebar: '#0074a8',
          'sidebar-dark': '#005d87',
          pill: '#02a9f4',
          'sidebar-pill': '#02a9f4',
          teal: '#1caf9a',
          'teal-hover': '#179986',
          'teal-dark': '#179986',
          blue: '#428bca',
          'blue-hover': '#357ebd',
          'blue-dark': '#357ebd',
          danger: '#d9534f',
          'danger-hover': '#c9302c',
          red: '#d9534f',
          'red-dark': '#c9302c',
          ink: '#1d2939',
          navy: '#1d2939',
          'navy-light': '#2b3b50',
          canvas: '#e4e7ea',
          subheader: '#f7f7f7',
          'tab-idle': '#eaecee',
          tab: '#eaecee',
          border: '#d3d7db',
          muted: '#636e7b',
          note: '#8a6d3b',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
