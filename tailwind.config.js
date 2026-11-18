/** @type {import('tailwindcss').Config} */

// Every colour is a token in public/css/input.css; this file only names them.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './public/**/*.html',
    './public/js/**/*.js',
  ],
  theme: {
    // phone: is the phone layout (760 px and below) and wins over sm: there.
    // desk: is the desktop layout (761 px and up). sm to 2xl keep Tailwind's
    // widths for the screens built before the two layouts.
    screens: {
      sm: '640px',
      desk: '761px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      phone: { max: '760px' },
    },
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        subtle: token('subtle'),
        'tab-idle': token('tab-idle'),
        track: token('track'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        primary: { DEFAULT: token('primary'), hover: token('primary-hover'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('secondary'), hover: token('secondary-hover'), foreground: token('secondary-foreground') },
        destructive: { DEFAULT: token('destructive'), hover: token('destructive-hover'), foreground: token('destructive-foreground') },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        info: { DEFAULT: token('info'), soft: token('info-soft') },
        error: { DEFAULT: token('error'), soft: token('error-soft') },
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          muted: token('sidebar-muted'),
          accent: token('sidebar-accent'),
          'accent-foreground': token('sidebar-accent-foreground'),
          primary: token('sidebar-primary'),
          'primary-foreground': token('sidebar-primary-foreground'),
          hover: 'var(--sidebar-hover)',
          border: 'var(--sidebar-border)',
        },
        scrim: 'var(--scrim)',

        // The names the screens use today, kept on the tokens so nothing changes
        // while each screen moves to the role names above as it is rebuilt.
        cirerms: {
          sidebar: token('sidebar'),
          pill: token('sidebar-primary'),
          teal: token('primary'),
          'teal-hover': token('primary-hover'),
          blue: token('secondary'),
          'blue-hover': token('secondary-hover'),
          danger: token('destructive'),
          'danger-hover': token('destructive-hover'),
          ink: token('foreground'),
          canvas: token('muted'),
          subheader: token('subtle'),
          'tab-idle': token('tab-idle'),
          border: token('border'),
          note: token('warning'),
        },
      },
      spacing: {
        tap: '2.75rem',            // 44 px: the smallest thing a finger presses on a phone
        control: '2.25rem',        // 36 px: a field or button on desktop
      },
      width: {
        rail: '15rem',             // the sidebar
        'rail-collapsed': '4.125rem', // the sidebar folded to icons
      },
      maxWidth: {
        page: '83.75rem',          // 1340 px: a page's content on a wide screen
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }], // 11 px: group labels, counts
      },
      borderRadius: {
        ctl: '0.25rem',            // fields, buttons and cards: the CIRERMS square-ish corner
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
