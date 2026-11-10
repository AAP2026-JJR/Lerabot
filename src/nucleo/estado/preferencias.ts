import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePreferenciasStore = defineStore('preferencias', () => {
  const monedaBase = ref<'USD' | 'PEN'>('USD')
  function cambiarMoneda(moneda: 'USD' | 'PEN') {
    monedaBase.value = moneda
  }
  return { monedaBase, cambiarMoneda }
})
