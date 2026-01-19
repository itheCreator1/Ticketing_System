const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Greek as default language
    lng: 'el',
    fallbackLng: 'en',
    supportedLngs: ['el', 'en'],
    preload: ['el', 'en'],

    // Namespace configuration
    ns: ['common', 'auth', 'tickets', 'users', 'departments', 'validation', 'errors'],
    defaultNS: 'common',

    // Backend options for loading translation files
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json')
    },

    // Language detection configuration
    // Session first, then cookie - skip header to prevent browser language override
    detection: {
      order: ['session', 'cookie'],
      lookupSession: 'language',
      lookupCookie: 'i18next',
      caches: ['session', 'cookie']
    },

    // Interpolation settings
    interpolation: {
      escapeValue: false // EJS handles escaping
    },

    // Disable debug in production
    debug: false
  });

module.exports = { i18next, middleware };
