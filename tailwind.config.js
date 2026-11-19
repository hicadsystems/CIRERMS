/** @type {import('tailwindcss').Config} */

// Every colour is a token in public/css/input.css; this file only names them.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

// One fluid type scale: each step grows linearly from its phone size at 360 px wide to its
// desktop size at 1440 px wide, and is held at either end. Sizes are [phone px, desktop px].
const fluid = ([p, d]) => {
  const rem = (px) => `${+(px / 16).toFixed(4)}rem`;
  const slope = (d - p) / 1080;                       // px of text per px of screen
  if (slope === 0) return rem(p);
  const base = +(p - 360 * slope).toFixed(4);
  return `clamp(${rem(p)}, ${base}px + ${+(slope * 100).toFixed(4)}vw, ${rem(d)})`;
};
const step = (size, line) => [fluid(size), { lineHeight: fluid(line) }];

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
          deep: token('sidebar-deep'),
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
        brand: { DEFAULT: token('brand'), foreground: token('brand-foreground'), fill: token('brand-fill'), deep: token('brand-deep') },
        login: {
          from: token('login-from'), via: token('login-via'), to: token('login-to'),
          ink: token('login-ink'), link: token('login-link'), dot: token('login-dot'),
          accent: { DEFAULT: token('login-accent'), deep: token('login-accent-deep') },
          // carries its own alpha (ivory glass by day, smoked by night), so it takes no /opacity
          glass: 'rgb(var(--login-glass))',
        },
        'on-fill': token('on-fill'),
        canvas: { from: token('canvas-from'), via: token('canvas-via'), to: token('canvas-to') },

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
        // [phone px, desktop px] for the size, then for its line height (see CONVENTIONS, Frontend)
        '2xs': step([11, 11], [16, 16]),   // group labels, counts
        xs: step([12, 12], [16, 16]),
        sm: step([13, 14], [20, 20]),      // body text, never below 13 px on a phone
        base: step([15, 16], [22, 24]),
        lg: step([16, 18], [24, 28]),
        xl: step([18, 20], [26, 28]),      // a record's name
        '2xl': step([20, 24], [28, 32]),   // a page title
        '3xl': step([22, 30], [28, 36]),   // a stat value, the sign-in heading
      },
      borderRadius: {
        ctl: '0.5rem',             // 8 px: fields, buttons, menu items
        card: '0.75rem',           // 12 px: cards, panels, dropdown lists
        dialog: '1rem',            // 16 px: dialogs, the command palette
      },
      boxShadow: {
        // soft, layered and tinted with the text colour, so surfaces lift without a hard edge
        // values are tokens in input.css: tinted with the text colour in light mode, black in dark mode
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        pop: 'var(--shadow-pop)',
        btn: 'var(--shadow-btn)',
      },
      keyframes: {
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '20%, 60%': { transform: 'translateX(-6px)' }, '40%, 80%': { transform: 'translateX(6px)' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        sheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',   // a wrong password
        rise: 'rise 0.25s ease-out',       // the lock card arriving, a dialog opening
        sheet: 'sheet 0.25s ease-out',     // a bottom sheet rising on a phone
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
