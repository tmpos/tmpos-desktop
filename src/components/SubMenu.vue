<script setup lang="ts">
export interface SubMenuItem {
  label: string
  icon: string
  key: string
}

defineProps<{
  items: SubMenuItem[]
  active: string
}>()

const emit = defineEmits<{
  select: [key: string]
}>()
</script>

<template>
  <div class="flex items-start gap-2.5 mb-6 flex-wrap">
    <button
      v-for="item in items"
      :key="item.key"
      class="sub-btn"
      :class="active === item.key ? 'sub-btn-active' : 'sub-btn-inactive'"
      @click="emit('select', item.key)"
    >
      <i :class="item.icon" class="text-xl"></i>
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.sub-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 6.5rem;
  height: 5rem;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.625rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  text-align: center;
  line-height: 1.15;
}

.sub-btn-inactive {
  background: var(--p-surface-50);
  color: var(--p-surface-600);
  border-color: var(--p-surface-200);
}
.sub-btn-inactive:hover {
  background: var(--p-surface-100);
  color: var(--p-surface-900);
  border-color: var(--p-surface-300);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

:global(.dark) .sub-btn-inactive {
  background: var(--p-surface-800);
  color: var(--p-surface-300);
  border-color: var(--p-surface-700);
}
:global(.dark) .sub-btn-inactive:hover {
  background: var(--p-surface-700);
  color: var(--p-surface-0);
  border-color: var(--p-surface-600);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.sub-btn-active {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  border-color: var(--p-primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.sub-btn-active:hover {
  background: var(--p-primary-600);
  border-color: var(--p-primary-600);
}
</style>
