import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(HttpApi)
  .init({
    supportedLngs: ['en', 'es'],
    fallbackLng: 'en',
    // Strip subtags so 'es-MX', 'es-419', 'es-ES' all resolve to 'es'
    load: 'languageOnly',
    detection: {
      // 1. User's saved preference (localStorage) wins
      // 2. OS/system language via navigator (auto-detect on first launch)
      // 3. <html lang=""> as last resort
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
