import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(localStorage.getItem('theme') === 'dark')
  const primaryColor = ref(localStorage.getItem('primaryColor') || 'blue')
  const colorShade = ref(localStorage.getItem('colorShade') || '500')
  const topbarBg = ref(localStorage.getItem('topbarBg') || 'white')

  const colorPalettes: Record<string, { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string; 950: string }> = {
    blue:     { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
    indigo:   { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
    violet:   { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' },
    teal:     { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' },
    emerald:  { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
    rose:     { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
    orange:   { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407' },
    sky:      { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
  }

  function applyPrimaryColor(color: string) {
    const palette = colorPalettes[color] || colorPalettes.blue
    const root = document.documentElement
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(`--p-primary-${key}`, value)
    }
    if (isDark.value) {
      root.style.setProperty('--p-primary-contrast', '#ffffff')
    }
  }

  function applyTheme() {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function setPrimaryColor(color: string) {
    primaryColor.value = color
    localStorage.setItem('primaryColor', color)
    applyPrimaryColor(color)
  }

  function setColorShade(shade: string) {
    colorShade.value = shade
    localStorage.setItem('colorShade', shade)
    const palette = colorPalettes[primaryColor.value] || colorPalettes.blue
    const key = shade as unknown as keyof typeof palette
    if (palette[key]) {
      document.documentElement.style.setProperty('--p-primary-500', palette[key])
      document.documentElement.style.setProperty('--p-primary-color', palette[key])
    }
  }

  function toggleTheme() {
    isDark.value = !isDark.value
  }

  function setTopbarBg(color: string) {
    topbarBg.value = color
    localStorage.setItem('topbarBg', color)
  }

  function setTopbarShade(shade: string) {
    const palette = colorPalettes[topbarBg.value]
    if (!palette) return
    const key = shade as unknown as keyof typeof palette
    if (palette[key]) {
      document.documentElement.style.setProperty('--topbar-bg', palette[key])
    }
  }

  watch(isDark, (val) => {
    localStorage.setItem('theme', val ? 'dark' : 'light')
    applyTheme()
    applyPrimaryColor(primaryColor.value)
  }, { immediate: true })

  applyPrimaryColor(primaryColor.value)

  return {
    isDark, primaryColor, colorShade, topbarBg, colorPalettes,
    toggleTheme, setPrimaryColor, setColorShade, applyPrimaryColor, setTopbarBg, setTopbarShade,
  }
})
