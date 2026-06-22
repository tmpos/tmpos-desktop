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

async function initApp() {
  const isCapacitor = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()

  if (isCapacitor) {
    const { initCapacitorApp } = await import('@/capacitor/index')
    await initCapacitorApp()
  }

  const app = createApp(App)

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

  import('@/services/tmCloudSyncService')
    .then(syncService => syncService.initAutoSyncFromConfig())
    .catch(error => console.warn('[TM Cloud] No se pudo cargar auto-sync:', error))
}

initApp()
