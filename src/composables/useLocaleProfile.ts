import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getLocaleProfile } from '@/i18n/localeProfiles'

export function useLocaleProfile() {
  const revision = ref(0)
  const refresh = () => { revision.value++ }
  onMounted(() => window.addEventListener('system-locale-changed', refresh))
  onUnmounted(() => window.removeEventListener('system-locale-changed', refresh))

  const profile = computed(() => {
    revision.value
    return getLocaleProfile()
  })

  return {
    profile,
    taxName: computed(() => profile.value.tax.shortName),
    taxFullName: computed(() => profile.value.tax.fullName),
    currency: computed(() => profile.value.currency),
    currencySymbol: computed(() => profile.value.currencySymbol),
    locale: computed(() => profile.value.locale),
  }
}
