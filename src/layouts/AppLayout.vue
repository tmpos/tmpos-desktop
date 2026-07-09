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
  <div v-else class="flex flex-col h-screen overflow-hidden bg-surface-0 dark:bg-surface-950 text-surface-900 dark:text-surface-0">
    <AppTopbar />
    <main class="flex-1 overflow-auto p-6 pb-4">
      <router-view :key="route.fullPath" />
    </main>
    <footer class="shrink-0 border-t border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 py-3 px-6 text-sm text-surface-500 dark:text-surface-400 flex items-center justify-center gap-1">
      <span>&copy; {{ new Date().getFullYear() }} TMPOS SRL</span>
      <span class="mx-1">v{{ version }}</span>
    </footer>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
