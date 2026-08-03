import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import router from './router'
import App from './App.vue'

import 'primeicons/primeicons.css'
import './assets/main.css'
import { initRuntimeI18n } from '@/i18n/runtimeI18n'
import { formatSystemCurrency, formatSystemDate, formatSystemDateTime, formatSystemNumber, getSystemCurrencyCode } from '@/i18n/localeProfiles'

async function initApp() {
  const isCapacitor = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()
  let capacitorApp: typeof import('@/capacitor/index') | undefined

  if (isCapacitor) {
    capacitorApp = await import('@/capacitor/index')
    await capacitorApp.initCapacitorApp()
  }

  const app = createApp(App)

  // Available in every template/DataTable and always resolved from the active country.
  app.config.globalProperties.$formatMoney = formatSystemCurrency
  app.config.globalProperties.$currencyCode = getSystemCurrencyCode
  app.config.globalProperties.$formatNumber = formatSystemNumber
  app.config.globalProperties.$formatDate = formatSystemDate
  app.config.globalProperties.$formatDateTime = formatSystemDateTime

  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue Error]', info, err)
  }

  router.onError((err) => {
    console.error('[Router Error]', err)
  })

  app.use(createPinia())
  app.use(router)
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: '.dark',
        cssLayer: {
          name: 'primevue',
          order: 'theme, base, primevue',
        },
      },
    },
  })
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)

  app.mount('#app')
  initRuntimeI18n()

  // Apply the legacy WebView overrides after Vue and PrimeVue have inserted
  // their styles. This also forces the ELO compositor to repaint the WebView.
  if (isCapacitor) {
    capacitorApp?.applyAndroidRenderingCompatibility()
  }

  // El equipo principal se encarga de la sincronizacion. Los clientes que
  // entran por red no deben iniciar procesos duplicados en segundo plano.
  if (!(window as any).__isNetworkClient) {
    import('@/services/tmCloudSyncService')
      .then(syncService => syncService.initAutoSyncFromConfig())
      .catch(error => console.warn('[TM Cloud] No se pudo cargar auto-sync:', error))
  }
}

initApp()
