<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import AppTopbar from '@/components/AppTopbar.vue'
import { version } from '../../package.json'

const route = useRoute()
const toast = useToast()
const isLogin = () => route.name === 'login'

function onTmCloudLocalChange(event: Event) {
  const detail = (event as CustomEvent).detail || {}
  if (!['INSERT', 'UPDATE'].includes(detail.eventType)) return
  toast.add({
    severity: detail.eventType === 'INSERT' ? 'success' : 'info',
    summary: detail.eventType === 'INSERT' ? 'Dato nuevo recibido' : 'Dato actualizado',
    detail: `${detail.table || 'Tabla'} se actualizo desde TM Cloud`,
    life: 3500,
  })
}

onMounted(() => window.addEventListener('tmcloud:local-change', onTmCloudLocalChange))
onBeforeUnmount(() => window.removeEventListener('tmcloud:local-change', onTmCloudLocalChange))
</script>

<template>
  <Toast position="top-right" />
  <div v-if="isLogin()" class="h-screen overflow-hidden bg-surface-100 dark:bg-surface-900">
    <router-view />
  </div>
  <div v-else class="app-shell flex flex-col h-screen overflow-hidden text-surface-900 dark:text-surface-0">
    <AppTopbar />
    <main class="app-main flex-1 overflow-auto">
      <div class="app-main-inner">
        <router-view :key="route.fullPath" />
      </div>
    </main>
    <footer class="app-footer shrink-0 py-3 px-6 text-sm text-surface-500 dark:text-surface-400 flex items-center justify-center gap-1">
      <span>&copy; {{ new Date().getFullYear() }} TMPOS SRL</span>
      <span class="mx-1">v{{ version }}</span>
    </footer>
  </div>
</template>

<style>
.app-shell {
  background:
    radial-gradient(circle at 18% 0%, rgba(59, 130, 246, 0.08), transparent 34rem),
    linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.dark .app-shell {
  background:
    radial-gradient(circle at 18% 0%, rgba(59, 130, 246, 0.14), transparent 34rem),
    linear-gradient(180deg, #020617 0%, #0f172a 100%);
}

.app-main {
  padding: 1.25rem;
}

.app-main-inner {
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
}

.app-footer {
  border-top: 1px solid rgba(203, 213, 225, 0.76);
  background: rgba(248, 250, 252, 0.78);
  backdrop-filter: blur(16px);
}

.dark .app-footer {
  border-top-color: rgba(51, 65, 85, 0.8);
  background: rgba(2, 6, 23, 0.76);
}

@media (min-width: 1024px) {
  .app-main {
    padding: 1.35rem 1.5rem 1.1rem;
  }
}

@media (max-width: 640px) {
  .app-main {
    padding: 0.85rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
