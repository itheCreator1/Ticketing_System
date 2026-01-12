/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Status colors
        'status-open': '#0d6efd',
        'status-progress': '#0dcaf0',
        'status-waiting-admin': '#ffc107',
        'status-waiting-dept': '#6c757d',
        'status-closed': '#198754',

        // Priority colors
        'priority-critical': '#dc3545',
        'priority-high': '#fd7e14',
        'priority-medium': '#0dcaf0',
        'priority-low': '#6c757d',
        'priority-unset': '#f8f9fa',

        // Bootstrap equivalent colors
        'bs-primary': '#0d6efd',
        'bs-secondary': '#6c757d',
        'bs-success': '#198754',
        'bs-danger': '#dc3545',
        'bs-warning': '#ffc107',
        'bs-info': '#0dcaf0',
        'bs-light': '#f8f9fa',
        'bs-dark': '#212529',

        // Neutral palette for UI components
        'neutral': {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          500: '#6b7280',
          700: '#374151',
          900: '#111827',
        }
      },
      keyframes: {
        'gentle-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.9' }
        },
        'pulse-subtle': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(108, 117, 125, 0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(108, 117, 125, 0)' }
        }
      },
      animation: {
        'gentle-pulse': 'gentle-pulse 3s ease-in-out infinite',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
