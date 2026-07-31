<template>
  <div class="p-4 sm:p-6 max-w-7xl mx-auto">
    <div v-if="loading" class="text-center py-16 text-surface-500"><i class="pi pi-spin pi-spinner text-2xl mb-2 block"></i>Cargando caja...</div>

    <div v-else-if="!turnoActual" class="text-center py-16 max-w-md mx-auto">
      <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600"><i class="pi pi-calculator text-3xl"></i></div>
      <h2 class="text-xl font-bold mb-1">No hay turno abierto</h2>
      <p class="text-sm text-surface-500 mb-6">Debes abrir un turno de caja para registrar movimientos</p>
      <button @click="abrirTurnoModal = true" class="px-6 py-3 rounded-xl text-white font-semibold shadow-lg transition-all hover:opacity-90 flex items-center gap-2 mx-auto" :style="{ background: 'var(--p-primary-500)' }"><i class="pi pi-plus"></i>Abrir Turno de Caja</button>
    </div>

    <div v-else>
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold">Control de Caja</h1>
              <span class="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"><span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>Turno Abierto</span>
              <span class="flex items-center gap-1 text-xs text-surface-500"><i class="pi pi-clock"></i>{{ horasAbiertas }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="cargarDatos" :disabled="refreshing" class="w-10 h-10 flex items-center justify-center rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"><i class="pi pi-refresh" :class="{ 'pi-spin': refreshing }"></i></button>
          <button @click="abrirCierreTurno" :disabled="cerrandoTurno" class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"><i class="pi pi-times-circle"></i>Cerrar Turno</button>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 space-y-4">
          <div class="p-5 rounded-xl text-white" :style="{ background: 'linear-gradient(135deg, #065f46, #047857)' }">
            <div class="flex items-center gap-2 text-sm opacity-90 mb-1"><i class="pi pi-money-bill"></i>Efectivo en Caja</div>
            <div v-if="!auth.isCajero" class="text-3xl font-extrabold mb-3">{{ formatMoney(efectivoEsperado) }}</div>
            <div v-else class="text-lg font-bold mb-3 flex items-center gap-2"><i class="pi pi-eye-slash"></i>Oculto hasta declarar el conteo</div>
            <div v-if="!auth.isCajero" class="border-t border-white/20 pt-3 space-y-1 text-sm opacity-90">
              <div class="flex justify-between"><span>Inicial:</span><span>{{ formatMoney(turnoActual.monto_inicial) }}</span></div>
              <div class="flex justify-between"><span>+ Ventas efectivo:</span><span class="text-green-300">{{ formatMoney(resumenVentas.efectivo) }}</span></div>
              <div class="flex justify-between"><span>+ Entradas:</span><span class="text-green-300">{{ formatMoney(turnoActual.entradas || 0) }}</span></div>
              <div class="flex justify-between"><span>- Gastos efectivo:</span><span class="text-red-300">{{ formatMoney(gastosEfectivoTurno) }}</span></div>
              <div class="flex justify-between"><span>- Retiros:</span><span class="text-red-300">{{ formatMoney(turnoActual.retiros || 0) }}</span></div>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-4 rounded-xl bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"><i class="pi pi-money-bill"></i></div>
              <div><div class="text-xs text-surface-500 uppercase">Efectivo</div><div class="font-bold">{{ formatMoney(resumenVentas.efectivo) }}</div></div>
            </div>
            <div class="p-4 rounded-xl bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><i class="pi pi-credit-card"></i></div>
              <div><div class="text-xs text-surface-500 uppercase">Tarjeta</div><div class="font-bold">{{ formatMoney(resumenVentas.tarjeta) }}</div></div>
            </div>
            <div class="p-4 rounded-xl bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600"><i class="pi pi-send"></i></div>
              <div><div class="text-xs text-surface-500 uppercase">Transferencia</div><div class="font-bold">{{ formatMoney(resumenVentas.transferencia) }}</div></div>
            </div>
            <div class="p-4 rounded-xl bg-surface-0 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600"><i class="pi pi-receipt"></i></div>
              <div><div class="text-xs text-surface-500 uppercase">Gastos</div><div class="font-bold">{{ formatMoney(gastosTurno) }}</div></div>
            </div>
          </div>

          <div class="p-5 rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10">
            <div class="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-300 mb-1"><i class="pi pi-chart-line"></i>Total Ventas del Turno</div>
            <div class="text-2xl font-extrabold text-orange-600 dark:text-orange-400">{{ formatMoney(resumenVentas.total) }}</div>
            <div class="text-sm text-orange-700 dark:text-orange-500">{{ ultimasVentas.length }} venta(s) en este turno</div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <button @click="abrirMovimiento('entrada')" class="p-4 rounded-xl font-semibold text-sm border border-transparent transition-all bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center justify-center gap-2"><i class="pi pi-plus-circle"></i>Entrada</button>
            <button @click="abrirMovimiento('retiro')" class="p-4 rounded-xl font-semibold text-sm border border-transparent transition-all bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center gap-2"><i class="pi pi-minus-circle"></i>Retiro</button>
            <button @click="agregarGasto" class="p-4 rounded-xl font-semibold text-sm border border-transparent transition-all bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 flex items-center justify-center gap-2"><i class="pi pi-receipt"></i>Gasto</button>
          </div>

          <div v-if="gastosLista.length" class="rounded-xl border border-red-200 dark:border-red-900/50 bg-surface-0 dark:bg-surface-800 overflow-hidden">
            <div class="flex justify-between items-center px-4 py-3 bg-red-50 dark:bg-red-900/20 font-bold text-sm text-red-800 dark:text-red-300">
              <span>Gastos del turno ({{ gastosLista.length }})</span>
              <span>-{{ formatMoney(gastosTurno) }}</span>
            </div>
            <div class="divide-y divide-red-100 dark:divide-red-900/20 max-h-52 overflow-auto">
              <div v-for="g in gastosLista" :key="g.id" class="flex justify-between items-center px-4 py-2.5 text-sm">
                <div><div class="font-medium">{{ g.comentario }}</div><div class="text-[10px] text-surface-400">{{ g.metodo_pago || 'EFECTIVO' }}<span v-if="g.banco_nombre"> · {{ g.banco_nombre }}</span></div></div>
                <span class="font-bold text-red-600 dark:text-red-400">-{{ formatMoney(g.cantidad || g.monto) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="xl:col-span-1">
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 overflow-hidden sticky top-4 max-h-[calc(100vh-120px)] flex flex-col">
            <div class="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
              <h3 class="font-semibold flex items-center gap-2"><i class="pi pi-receipt text-primary-500"></i>Ultimas Ventas</h3>
              <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-700">{{ ultimasVentas.length }}</span>
            </div>
            <div v-if="ultimasVentas.length" class="flex-1 overflow-y-auto p-2 space-y-1">
              <div v-for="v in ultimasVentas" :key="v.id" class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors cursor-pointer" @click="verDetalleVenta(v)">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm" :class="v.metodo_pago === 'efectivo' ? 'bg-green-100 text-green-600' : v.metodo_pago === 'tarjeta' || v.metodo_pago?.includes('tarjeta') ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'"><i :class="v.metodo_pago === 'efectivo' ? 'pi pi-money-bill' : v.metodo_pago === 'tarjeta' || v.metodo_pago?.includes('tarjeta') ? 'pi pi-credit-card' : 'pi pi-send'" class="text-xs"></i></div>
                <div class="flex-1 min-w-0"><div class="text-sm font-medium">{{ v.nombre_cliente || 'Cliente General' }}</div><div class="text-xs text-surface-500">{{ formatTime(v.created_at) }}</div></div>
                <div class="text-right"><div class="font-bold text-sm">{{ formatMoney(v.total) }}</div></div>
              </div>
            </div>
            <div v-else class="flex-1 flex flex-col items-center justify-center p-8 text-surface-400"><i class="pi pi-receipt text-3xl mb-2"></i><p class="text-sm">No hay ventas en este turno</p></div>
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="abrirTurnoModal" header="Abrir Turno de Caja" modal :style="{ width: 'min(24rem, 92vw)' }" :closable="false">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Monto Inicial</label>
          <div class="flex items-center rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
            <span class="px-3 py-2.5 text-sm font-semibold bg-surface-100 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-600">RD$</span>
            <input v-model.number="montoInicial" type="number" step="0.01" min="0" class="flex-1 px-3 py-2.5 text-sm font-bold outline-none bg-transparent" placeholder="0.00" />
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Observacion</label>
          <input v-model="observacionApertura" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Opcional" />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <button @click="abrirTurnoModal = false" class="px-4 py-2 rounded-lg text-sm font-medium border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700">Cancelar</button>
          <button @click="guardarApertura" :disabled="abriendoTurno" class="px-5 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2" :style="{ backgroundColor: 'var(--p-primary-500)' }"><i v-if="abriendoTurno" class="pi pi-spin pi-spinner"></i><i v-else class="pi pi-check"></i>Abrir Turno</button>
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="showMovimientoModal" :header="tipoMovimiento === 'entrada' ? 'Entrada de Efectivo' : 'Retiro de Efectivo'" modal :style="{ width: '90%', maxWidth: '400px' }" :closable="false">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Monto</label>
          <div class="flex items-center rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
            <span class="px-3 py-2.5 text-sm font-semibold bg-surface-100 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-600">RD$</span>
            <input v-model.number="montoMovimiento" type="number" step="0.01" min="0" class="flex-1 px-3 py-2.5 text-sm font-bold outline-none bg-transparent" placeholder="0.00" />
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Descripcion (opcional)</label>
          <input v-model="descripcionMovimiento" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ej: Cambio para cliente" />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <button @click="showMovimientoModal = false" class="px-4 py-2 rounded-lg text-sm font-medium border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700">Cancelar</button>
          <button @click="guardarMovimiento" :disabled="procesandoMovimiento || !montoMovimiento" class="px-5 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2" :class="tipoMovimiento === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'"><i v-if="procesandoMovimiento" class="pi pi-spin pi-spinner"></i><i v-else class="pi pi-check"></i>Registrar</button>
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="showGastoModal" header="Registrar Gasto" modal :style="{ width: 'min(24rem, 92vw)' }" :closable="false">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Categoria</label>
          <select v-model="gastoForm.categoria" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Seleccionar</option>
            <option v-for="cat in categoriasGasto" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Descripcion <span class="text-red-500">*</span></label>
          <input v-model="gastoForm.descripcion" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ej: Compra de hielo" />
        </div>
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Monto <span class="text-red-500">*</span></label>
          <div class="flex items-center rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
            <span class="px-3 py-2.5 text-sm font-semibold bg-surface-100 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-600">RD$</span>
            <input v-model.number="gastoForm.monto" type="number" step="0.01" min="0" class="flex-1 px-3 py-2.5 text-sm font-bold outline-none bg-transparent" placeholder="0.00" />
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold mb-1.5 block">Metodo de pago</label>
          <select v-model="gastoForm.metodo_pago" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm outline-none focus:ring-2 focus:ring-primary-500" @change="gastoForm.banco_id = null">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </div>
        <div v-if="gastoForm.metodo_pago === 'TRANSFERENCIA'">
          <label class="text-xs font-semibold mb-1.5 block">Banco de origen <span class="text-red-500">*</span></label>
          <select v-model="gastoForm.banco_id" :disabled="cargandoBancosGasto" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm outline-none focus:ring-2 focus:ring-primary-500">
            <option :value="null">{{ cargandoBancosGasto ? 'Cargando bancos...' : 'Seleccionar banco' }}</option>
            <option v-for="banco in bancosGasto" :key="banco.uid || banco.id" :value="banco.id">{{ banco.nombre }} · {{ formatMoney(Number(banco.saldo || 0)) }}</option>
          </select>
          <p v-if="!cargandoBancosGasto && bancosGasto.length === 0" class="text-xs text-amber-500 mt-1">No hay bancos disponibles en este almacen.</p>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <button @click="showGastoModal = false" class="px-4 py-2 rounded-lg text-sm font-medium border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700">Cancelar</button>
          <button @click="guardarGasto" :disabled="procesandoGasto || !gastoForm.descripcion || !gastoForm.monto || (gastoForm.metodo_pago === 'TRANSFERENCIA' && !gastoForm.banco_id)" class="px-5 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50"><i v-if="procesandoGasto" class="pi pi-spin pi-spinner"></i><i v-else class="pi pi-check"></i>Guardar Gasto</button>
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="showDetalleVenta" :header="'Venta #' + (ventaSeleccionada?.id || '')" modal :style="{ width: '90%', maxWidth: '500px' }" :closable="false">
      <div v-if="ventaSeleccionada" class="space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-surface-500 text-xs">Cliente</span><p class="font-medium">{{ ventaSeleccionada.nombre_cliente || 'Cliente General' }}</p></div>
          <div><span class="text-surface-500 text-xs">Metodo Pago</span><p class="font-medium">{{ ventaSeleccionada.metodo_pago || '—' }}</p></div>
          <div><span class="text-surface-500 text-xs">Fecha</span><p>{{ formatDate(ventaSeleccionada.created_at) }}</p></div>
          <div><span class="text-surface-500 text-xs">Vendedor</span><p>{{ ventaSeleccionada.vendedor || '—' }}</p></div>
        </div>
        <div class="border-t border-surface-200 dark:border-surface-700 pt-3">
          <div class="flex justify-between text-lg font-bold"><span>Total</span><span>{{ formatMoney(ventaSeleccionada.total) }}</span></div>
        </div>
      </div>
      <template #footer>
        <button @click="showDetalleVenta = false" class="px-4 py-2 rounded-lg text-sm font-medium border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700">Cerrar</button>
      </template>
    </Dialog>

    <Dialog v-model:visible="showCierreModal" modal :style="{ width: 'min(54rem, 94vw)' }" :closable="!cerrandoTurno" :draggable="false">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary-600 text-white shadow-sm flex items-center justify-center">
            <i class="pi pi-calculator text-lg"></i>
          </div>
          <div>
            <h2 class="text-base font-bold text-surface-900 dark:text-surface-0">Cierre de caja</h2>
            <p class="text-xs text-surface-500 mt-0.5">Registra la cantidad de piezas por denominación</p>
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <div v-if="!esCierreCiego || cierreRevelado" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded-xl bg-surface-50 dark:bg-surface-800/70 px-3.5 py-3 shadow-sm ring-1 ring-surface-200/60 dark:ring-surface-700">
            <div class="flex items-center gap-2 text-xs font-medium text-surface-500 mb-1"><i class="pi pi-wallet"></i>Efectivo esperado</div>
            <p class="text-lg font-bold text-surface-900 dark:text-surface-0 tabular-nums">{{ formatMoney(efectivoEsperado) }}</p>
          </div>
          <div class="rounded-xl bg-primary-50 dark:bg-primary-950/30 px-3.5 py-3 shadow-sm ring-1 ring-primary-100/80 dark:ring-primary-900/60">
            <div class="flex items-center gap-2 text-xs font-medium text-primary-700 dark:text-primary-300 mb-1"><i class="pi pi-check-circle"></i>Total contado</div>
            <p class="text-lg font-bold text-primary-700 dark:text-primary-300 tabular-nums">{{ formatMoney(totalConteo) }}</p>
          </div>
          <div class="rounded-xl px-3.5 py-3 shadow-sm ring-1" :class="totalConteo === efectivoEsperado ? 'bg-green-50 ring-green-100/80 dark:bg-green-950/30 dark:ring-green-900/60' : 'bg-amber-50 ring-amber-100/80 dark:bg-amber-950/30 dark:ring-amber-900/60'">
            <div class="flex items-center gap-2 text-xs font-medium mb-1" :class="totalConteo === efectivoEsperado ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'">
              <i class="pi" :class="totalConteo === efectivoEsperado ? 'pi-verified' : 'pi-exclamation-circle'"></i>Diferencia
            </div>
            <p class="text-lg font-bold tabular-nums" :class="totalConteo === efectivoEsperado ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'">
              {{ totalConteo - efectivoEsperado > 0 ? '+' : totalConteo - efectivoEsperado < 0 ? '-' : '' }}{{ formatMoney(Math.abs(totalConteo - efectivoEsperado)) }}
            </p>
          </div>
        </div>
        <div v-else class="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4">
          <div class="flex gap-3">
            <div class="w-9 h-9 shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center"><i class="pi pi-shield"></i></div>
            <div>
              <p class="font-semibold text-blue-900 dark:text-blue-100">Cierre ciego activado</p>
              <p class="text-sm text-blue-700 dark:text-blue-300">Cuenta todo el efectivo y declara el resultado. El monto esperado y la diferencia se mostrarán después.</p>
              <p class="text-lg font-bold text-blue-900 dark:text-blue-100 mt-2">Declarado: {{ formatMoney(totalConteo) }}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3">
        <section class="rounded-2xl bg-surface-50/80 dark:bg-surface-900/30 p-3.5">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-primary-500"></span>
              <h3 class="text-sm font-bold text-surface-800 dark:text-surface-100">Billetes</h3>
              <p class="text-xs text-surface-400">Cantidad por denominación</p>
            </div>
          </div>
          <div class="space-y-2">
            <label v-for="d in denominaciones.filter(d => d.tipo === 'billete')" :key="d.valor" class="group grid grid-cols-[3.25rem_1fr_auto_4rem_auto_6rem] items-center gap-2 rounded-xl bg-surface-0 dark:bg-surface-800 px-2.5 py-2 shadow-sm ring-1 ring-surface-200/60 dark:ring-surface-700 transition-all focus-within:ring-2 focus-within:ring-primary-300 dark:focus-within:ring-primary-700">
              <span class="relative w-[3.25rem] h-8 rounded-md overflow-hidden text-white shadow-sm flex items-center justify-center" :style="{ background: d.color }">
                <span class="absolute -right-1 -bottom-2 w-7 h-7 rounded-full border border-white/25"></span>
                <span class="text-[10px] font-black tracking-tight">{{ d.valor.toLocaleString() }}</span>
              </span>
              <span class="text-xs font-bold text-surface-700 dark:text-surface-200">{{ d.label }}</span>
              <span class="text-xs font-semibold text-surface-300">×</span>
              <input
                v-model.number="conteo[d.valor]"
                type="number"
                inputmode="numeric"
                min="0"
                :disabled="esCierreCiego && cierreRevelado"
                placeholder="0"
                class="w-16 h-9 px-2 rounded-lg border-0 bg-surface-50 dark:bg-surface-900 text-sm text-center font-bold tabular-nums outline-none ring-1 ring-surface-200/70 dark:ring-surface-700 transition-all focus:ring-2 focus:ring-primary-400 disabled:opacity-60"
                @focus="$event.target.select()"
              />
              <span class="text-xs font-semibold text-surface-300">=</span>
              <span class="text-xs text-right font-bold text-surface-600 dark:text-surface-300 tabular-nums">{{ formatMoney(d.valor * (conteo[d.valor] || 0)) }}</span>
            </label>
          </div>
        </section>

        <section class="rounded-2xl bg-surface-50/80 dark:bg-surface-900/30 p-3.5">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              <h3 class="text-sm font-bold text-surface-800 dark:text-surface-100">Monedas</h3>
              <p class="text-xs text-surface-400">Cantidad por denominación</p>
            </div>
          </div>
          <div class="space-y-2">
            <label v-for="d in denominaciones.filter(d => d.tipo === 'moneda')" :key="d.valor" class="group grid grid-cols-[2.25rem_1fr_auto_3.5rem_auto_5.25rem] items-center gap-2 rounded-xl bg-surface-0 dark:bg-surface-800 px-2.5 py-2 shadow-sm ring-1 ring-surface-200/60 dark:ring-surface-700 transition-all focus-within:ring-2 focus-within:ring-primary-300 dark:focus-within:ring-primary-700">
              <span class="w-8 h-8 rounded-full text-white shadow-sm ring-2 ring-white/50 flex items-center justify-center" :style="{ background: d.color }">
                <span class="text-[10px] font-black">{{ d.valor }}</span>
              </span>
              <span class="text-xs font-bold text-surface-700 dark:text-surface-200">{{ d.label }}</span>
              <span class="text-xs font-semibold text-surface-300">×</span>
              <input
                v-model.number="conteo[d.valor]"
                type="number"
                inputmode="numeric"
                min="0"
                :disabled="esCierreCiego && cierreRevelado"
                placeholder="0"
                class="w-14 h-9 px-2 rounded-lg border-0 bg-surface-50 dark:bg-surface-900 text-sm text-center font-bold tabular-nums outline-none ring-1 ring-surface-200/70 dark:ring-surface-700 transition-all focus:ring-2 focus:ring-primary-400 disabled:opacity-60"
                @focus="$event.target.select()"
              />
              <span class="text-xs font-semibold text-surface-300">=</span>
              <span class="text-[11px] text-right font-bold text-surface-600 dark:text-surface-300 tabular-nums">{{ formatMoney(d.valor * (conteo[d.valor] || 0)) }}</span>
            </label>
            <div class="mt-3 rounded-xl bg-surface-900 dark:bg-surface-100 px-3.5 py-3 text-white dark:text-surface-900 shadow-sm">
              <div class="flex items-center justify-between text-xs opacity-70"><span>Piezas contadas</span><strong>{{ totalPiezas }}</strong></div>
              <div class="flex items-end justify-between mt-2"><span class="text-xs font-medium opacity-70">Total efectivo</span><strong class="text-lg tabular-nums">{{ formatMoney(totalConteo) }}</strong></div>
            </div>
          </div>
        </section>
        </div>
      </div>
      <template #footer>
        <div class="w-full flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p class="hidden sm:block text-xs text-surface-400"><i class="pi pi-info-circle mr-1"></i>Verifica el conteo antes de confirmar</p>
          <div class="flex justify-end gap-2">
            <button @click="showCierreModal = false" :disabled="cerrandoTurno" class="px-4 py-2.5 rounded-lg text-sm font-semibold text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-50 transition-colors">Cancelar</button>
            <button v-if="esCierreCiego && !cierreRevelado" @click="declararConteo" :disabled="cerrandoTurno" class="px-5 py-2.5 rounded-lg text-white text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors">
              <i class="pi pi-lock"></i>Declarar conteo
            </button>
            <button v-else @click="showCierreModal = false; cerrarTurno()" :disabled="cerrandoTurno" class="px-5 py-2.5 rounded-lg text-white text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors">
              <i class="pi" :class="cerrandoTurno ? 'pi-spin pi-spinner' : 'pi-check'"></i>
              {{ cerrandoTurno ? 'Cerrando...' : 'Confirmar cierre' }}
            </button>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useAlmacenStore } from '@/stores/almacen.store'
import Dialog from 'primevue/dialog'

const router = useRouter()
const auth = useAuthStore()
const almacenStore = useAlmacenStore()
const loading = ref(true)
const refreshing = ref(false)
const turnoActual = ref(null)
const resumenVentas = ref({ efectivo: 0, tarjeta: 0, transferencia: 0, total: 0, cantidad: 0 })
const gastosTurno = ref(0)
const gastosEfectivoTurno = ref(0)
const gastosLista = ref([])
const ultimasVentas = ref([])
const cerrandoTurno = ref(false)

const showCierreModal = ref(false)
const cierreRevelado = ref(false)
const esCierreCiego = computed(() => Boolean(auth.isCajero))
const denominaciones = [
  { valor: 2000, label: '$2,000', tipo: 'billete', color: 'linear-gradient(135deg, #7c3aed, #a78bfa)' },
  { valor: 1000, label: '$1,000', tipo: 'billete', color: 'linear-gradient(135deg, #dc2626, #fb7185)' },
  { valor: 500, label: '$500', tipo: 'billete', color: 'linear-gradient(135deg, #2563eb, #60a5fa)' },
  { valor: 200, label: '$200', tipo: 'billete', color: 'linear-gradient(135deg, #d97706, #fbbf24)' },
  { valor: 100, label: '$100', tipo: 'billete', color: 'linear-gradient(135deg, #059669, #34d399)' },
  { valor: 50, label: '$50', tipo: 'billete', color: 'linear-gradient(135deg, #475569, #94a3b8)' },
  { valor: 25, label: '$25', tipo: 'moneda', color: 'linear-gradient(135deg, #b7791f, #f6c453)' },
  { valor: 10, label: '$10', tipo: 'moneda', color: 'linear-gradient(135deg, #64748b, #cbd5e1)' },
  { valor: 5, label: '$5', tipo: 'moneda', color: 'linear-gradient(135deg, #a16207, #eab308)' },
  { valor: 1, label: '$1', tipo: 'moneda', color: 'linear-gradient(135deg, #64748b, #94a3b8)' },
]
const conteo = ref({})

const abrirTurnoModal = ref(false)
const montoInicial = ref(0)
const observacionApertura = ref('')
const abriendoTurno = ref(false)

const showMovimientoModal = ref(false)
const tipoMovimiento = ref('entrada')
const montoMovimiento = ref(0)
const descripcionMovimiento = ref('')
const procesandoMovimiento = ref(false)

const showGastoModal = ref(false)
const gastoForm = ref({ categoria: '', descripcion: '', monto: 0, metodo_pago: 'EFECTIVO', banco_id: null })
const procesandoGasto = ref(false)
const categoriasGasto = ['Alimentos', 'Servicios', 'Suministros', 'Nomina', 'Mantenimiento', 'Transporte', 'Otros']
const bancosGasto = ref([])
const cargandoBancosGasto = ref(false)

const showDetalleVenta = ref(false)
const ventaSeleccionada = ref(null)

let refreshInterval = null

const efectivoEsperado = computed(() => {
  if (!turnoActual.value) return 0
  const inicial = turnoActual.value.monto_inicial || 0
  const ventas = resumenVentas.value.efectivo || 0
  const gastos = gastosEfectivoTurno.value || 0
  const entradas = turnoActual.value.entradas || 0
  const retiros = turnoActual.value.retiros || 0
  return inicial + ventas + entradas - gastos - retiros
})

const horasAbiertas = computed(() => {
  if (!turnoActual.value?.created_at) return '0h 0m'
  const inicio = new Date(turnoActual.value.created_at)
  const ahora = new Date()
  const diff = ahora - inicio
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
})

function formatMoney(val) {
  return 'RD$ ' + (val || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
}

async function ensureTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS caja_turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, monto_inicial REAL DEFAULT 0, entradas REAL DEFAULT 0,
      retiros REAL DEFAULT 0, estado TEXT DEFAULT 'abierto', observacion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS caja_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, turno_id INTEGER, tipo TEXT,
      monto REAL DEFAULT 0, descripcion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `
  try {
    await window.electron.invoke('consultaservidor', 'executeSQL', sql)
  } catch (e) {
    await window.electron.invoke('consultaservidor', 'rawQuery', 'CREATE TABLE IF NOT EXISTS caja_turnos (id INTEGER PRIMARY KEY AUTOINCREMENT, monto_inicial REAL DEFAULT 0, entradas REAL DEFAULT 0, retiros REAL DEFAULT 0, estado TEXT DEFAULT "abierto", observacion TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
    await window.electron.invoke('consultaservidor', 'rawQuery', 'CREATE TABLE IF NOT EXISTS caja_movimientos (id INTEGER PRIMARY KEY AUTOINCREMENT, turno_id INTEGER, tipo TEXT, monto REAL DEFAULT 0, descripcion TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
  }
}

async function cargarDatos() {
  refreshing.value = true
  try {
    await ensureTables()
    const res = await window.db.getAll('caja_turnos')
    if (res.success && res.data?.length) {
      const abierto = res.data.find(r => r.estado === 'abierto' && (
        almacenStore.activeUid && r.almacen_uid
          ? String(r.almacen_uid) === almacenStore.activeUid
          : !Number(r.almacen_id) || Number(r.almacen_id) === almacenStore.activeId
      ))
      if (abierto) {
        turnoActual.value = abierto
        await cargarVentas()
        await cargarGastos()
        await cargarUltimasVentas()
      } else {
        turnoActual.value = null
      }
    } else {
      turnoActual.value = null
    }
  } catch (e) {
    console.error('Error cargando caja:', e)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function cargarVentas() {
  if (!turnoActual.value) return
  try {
    const res = await window.db.getAll('facturas')
    if (!res.success || !res.data) return
    const ventas = res.data.filter(v => {
      return Number(v.turno_id) === Number(turnoActual.value.id) && v.estado_factura === 'PAGADA'
    })
    resumenVentas.value = resumirVentas(ventas)
  } catch (e) {
    console.error('Error cargando ventas:', e)
  }
}

async function cargarGastos() {
  if (!turnoActual.value) return
  try {
    const res = await window.db.getAll('gastos')
    if (!res.success || !res.data) return
    const turnoInicio = parseDbDate(turnoActual.value.created_at)
    const gastos = res.data.filter(g => {
      if (Number(g.turno_id || 0) > 0) {
        return Number(g.turno_id) === Number(turnoActual.value.id)
      }
      return parseDbDate(g.created_at || `${g.fecha || ''} ${g.hora || ''}`) >= turnoInicio
    })
    gastosLista.value = gastos
    gastosTurno.value = gastos.reduce((s, g) => s + Number(g.cantidad || g.monto || 0), 0)
    gastosEfectivoTurno.value = gastos
      .filter(g => String(g.metodo_pago || 'EFECTIVO').toUpperCase() !== 'TRANSFERENCIA')
      .reduce((s, g) => s + Number(g.cantidad || g.monto || 0), 0)
  } catch (e) {
    console.error('Error cargando gastos:', e)
  }
}

async function cargarUltimasVentas() {
  if (!turnoActual.value) return
  try {
    const res = await window.db.getAll('facturas')
    if (!res.success || !res.data) return
    const turnoInicio = new Date(turnoActual.value.created_at).getTime()
    ultimasVentas.value = res.data
      .filter(v => Number(v.turno_id) === Number(turnoActual.value.id) && v.estado_factura === 'PAGADA')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
  } catch (e) {
    console.error('Error cargando ultimas ventas:', e)
  }
}

async function guardarApertura() {
  if (abriendoTurno.value) return
  abriendoTurno.value = true
  try {
    const user = localStorage.getItem('mr_user_usuario') || ''
    await window.db.insert('caja_turnos', {
      monto_inicial: montoInicial.value || 0,
      entradas: 0, retiros: 0, estado: 'abierto',
      observacion: observacionApertura.value || '',
      usuario_id: Number(localStorage.getItem('mr_user_id') || 0),
      usuario_nombre: user,
      almacen_id: almacenStore.activeId || 0,
      almacen_uid: almacenStore.activeUid || '',
    })
    abrirTurnoModal.value = false
    await cargarDatos()
  } catch (e) {
    console.error('Error abriendo turno:', e)
  } finally {
    abriendoTurno.value = false
  }
}

function abrirMovimiento(tipo) {
  tipoMovimiento.value = tipo
  montoMovimiento.value = 0
  descripcionMovimiento.value = ''
  showMovimientoModal.value = true
}

async function guardarMovimiento() {
  if (procesandoMovimiento.value || !montoMovimiento.value || montoMovimiento.value <= 0) return
  procesandoMovimiento.value = true
  try {
    const monto = Number(montoMovimiento.value)
    await window.db.insert('caja_movimientos', {
      turno_id: turnoActual.value.id,
      tipo: tipoMovimiento.value,
      monto,
      descripcion: descripcionMovimiento.value || '',
      almacen_id: almacenStore.activeId || 0,
      almacen_uid: almacenStore.activeUid || '',
    })
    const campo = tipoMovimiento.value === 'entrada' ? 'entradas' : 'retiros'
    const valorActual = turnoActual.value[campo] || 0
    await window.db.update('caja_turnos', turnoActual.value.id, { [campo]: valorActual + monto })
    showMovimientoModal.value = false
    await cargarDatos()
  } catch (e) {
    console.error('Error guardando movimiento:', e)
  } finally {
    procesandoMovimiento.value = false
  }
}

async function cargarBancosGasto() {
  cargandoBancosGasto.value = true
  try {
    const res = await window.db.getAll('bancos')
    bancosGasto.value = (res.success ? res.data || [] : []).filter(banco =>
      almacenStore.activeUid && banco.almacen_uid
        ? String(banco.almacen_uid) === almacenStore.activeUid
        : !Number(banco.almacen_id) || Number(banco.almacen_id) === almacenStore.activeId
    )
  } catch (_) {
    bancosGasto.value = []
  } finally {
    cargandoBancosGasto.value = false
  }
}

async function agregarGasto() {
  gastoForm.value = { categoria: '', descripcion: '', monto: 0, metodo_pago: 'EFECTIVO', banco_id: null }
  showGastoModal.value = true
  await cargarBancosGasto()
}

async function guardarGasto() {
  if (procesandoGasto.value || !gastoForm.value.descripcion.trim() || !gastoForm.value.monto) return
  if (gastoForm.value.metodo_pago === 'TRANSFERENCIA' && !gastoForm.value.banco_id) return
  procesandoGasto.value = true
  try {
    const ahora = new Date()
    const fechaLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
    const banco = bancosGasto.value.find(item => Number(item.id) === Number(gastoForm.value.banco_id || 0))
    const comentario = gastoForm.value.categoria ? `${gastoForm.value.categoria}: ${gastoForm.value.descripcion.trim()}` : gastoForm.value.descripcion.trim()
    const result = await window.electron.invoke('gastos:guardarConPago', {
      cantidad: Number(gastoForm.value.monto),
      comentario,
      metodo_pago: gastoForm.value.metodo_pago,
      banco_id: banco?.id || 0,
      banco_uid: banco?.uid || '',
      turno_id: turnoActual.value.id,
      fecha: fechaLocal,
      hora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
      almacen_id: almacenStore.activeId || 0,
      almacen_uid: almacenStore.activeUid || '',
      usuario: auth.user?.usuario || auth.user?.nombre || '',
    })
    console.log('[Caja] Resultado insert gasto:', JSON.stringify(result))
    if (!result.success) {
      alert('Error al guardar gasto: ' + (result.error || 'Error desconocido'))
      return
    }
    showGastoModal.value = false
    await cargarGastos()
  } catch (e) {
    console.error('[Caja] Error guardando gasto:', e)
    alert('Error al guardar gasto: ' + (e.message || 'Error desconocido'))
  } finally {
    procesandoGasto.value = false
  }
}

function parseDbDate(value) {
  if (!value) return 0
  const normalized = String(value).trim().replace(' ', 'T')
  const timestamp = new Date(normalized).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function resumirVentas(ventas) {
  let efectivo = 0
  let tarjeta = 0
  let transferencia = 0
  let total = 0
  for (const venta of ventas) {
    const ventaTotal = Number(venta.total || 0)
    let ventaEfectivo = Number(venta.efectivo || 0)
    let ventaTarjeta = Number(venta.tarjeta || 0)
    let ventaTransferencia = Number(venta.transferencia || 0)
    if (ventaEfectivo + ventaTarjeta + ventaTransferencia === 0) {
      const metodo = String(venta.metodo_pago || '').toLowerCase()
      if (metodo.includes('tarjeta')) ventaTarjeta = ventaTotal
      else if (metodo.includes('transferencia')) ventaTransferencia = ventaTotal
      else ventaEfectivo = ventaTotal
    }
    efectivo += ventaEfectivo
    tarjeta += ventaTarjeta
    transferencia += ventaTransferencia
    total += ventaTotal
  }
  return { efectivo, tarjeta, transferencia, total, cantidad: ventas.length }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function moneyHtml(value) {
  return `RD$ ${Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dateHtml(value) {
  if (!value) return '-'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return escapeHtml(value)
  return date.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
}

function calcularDuracion(inicio, fin) {
  const diff = Math.max(0, new Date(fin).getTime() - new Date(String(inicio).replace(' ', 'T')).getTime())
  const horas = Math.floor(diff / 3600000)
  const minutos = Math.floor((diff % 3600000) / 60000)
  return `${horas}h ${minutos}m`
}

async function obtenerResumenCierre() {
  await Promise.all([cargarVentas(), cargarGastos(), cargarUltimasVentas()])
  const turno = { ...turnoActual.value }
  const [empresaRes, impresoraRes, correoRes, movimientosRes, ventasRes] = await Promise.all([
    window.db.getAll('empresa'),
    window.db.getAll('impresoras_config'),
    window.db.getAll('correo'),
    window.db.getAll('caja_movimientos'),
    window.db.getAll('facturas'),
  ])
  const ventas = (ventasRes.success ? ventasRes.data || [] : [])
    .filter(v => Number(v.turno_id) === Number(turno.id) && v.estado_factura === 'PAGADA')
    .sort((a, b) => parseDbDate(a.created_at) - parseDbDate(b.created_at))
  const movimientos = (movimientosRes.success ? movimientosRes.data || [] : [])
    .filter(m => Number(m.turno_id) === Number(turno.id))
    .sort((a, b) => parseDbDate(a.created_at) - parseDbDate(b.created_at))
  const entradas = movimientos.filter(m => m.tipo === 'entrada')
  const retiros = movimientos.filter(m => m.tipo === 'retiro')
  const resumen = resumirVentas(ventas)
  const totalEntradas = entradas.reduce((sum, item) => sum + Number(item.monto || 0), 0)
  const totalRetiros = retiros.reduce((sum, item) => sum + Number(item.monto || 0), 0)
  const totalGastos = gastosLista.value.reduce((sum, item) => sum + Number(item.cantidad || item.monto || 0), 0)
  const totalGastosEfectivo = gastosLista.value
    .filter(item => String(item.metodo_pago || 'EFECTIVO').toUpperCase() !== 'TRANSFERENCIA')
    .reduce((sum, item) => sum + Number(item.cantidad || item.monto || 0), 0)
  const cerradoEn = new Date().toISOString()

  return {
    turno,
    empresa: empresaRes.success ? empresaRes.data?.[0] || {} : {},
    impresora: impresoraRes.success ? impresoraRes.data?.[0] || {} : {},
    correo: correoRes.success ? correoRes.data?.[0] || {} : {},
    ventas,
    gastos: [...gastosLista.value].sort((a, b) => parseDbDate(a.created_at) - parseDbDate(b.created_at)),
    entradas,
    retiros,
    resumen,
    totalEntradas,
    totalRetiros,
    totalGastos,
    totalGastosEfectivo,
    efectivoEsperado: Number(turno.monto_inicial || 0) + resumen.efectivo + totalEntradas - totalGastosEfectivo - totalRetiros,
    cerradoEn,
    duracion: calcularDuracion(turno.created_at, cerradoEn),
    conteo: { ...conteo.value },
  }
}

function filasDetalle(items, render, emptyText) {
  return items.length ? items.map(render).join('') : `<tr><td colspan="4" class="empty">${emptyText}</td></tr>`
}

function construirTicketCierre(data) {
  const empresaNombre = escapeHtml(data.empresa.nombre || data.empresa.legal || 'TMPOS SRL')
  const ventas = filasDetalle(data.ventas, venta => `
    <tr><td>${escapeHtml(venta.no_factura || venta.id)}</td><td>${escapeHtml(venta.metodo_pago || 'Efectivo')}</td><td>${dateHtml(venta.created_at)}</td><td class="right">${moneyHtml(venta.total)}</td></tr>`, 'Sin ventas')
  const gastos = filasDetalle(data.gastos, gasto => `
    <tr><td colspan="2">${escapeHtml(gasto.comentario || gasto.descripcion || 'Gasto')}</td><td>${dateHtml(gasto.created_at)}</td><td class="right">-${moneyHtml(gasto.cantidad || gasto.monto)}</td></tr>`, 'Sin gastos')
  const movimientos = filasDetalle([...data.entradas, ...data.retiros].sort((a, b) => parseDbDate(a.created_at) - parseDbDate(b.created_at)), item => `
    <tr><td>${escapeHtml(String(item.tipo || '').toUpperCase())}</td><td>${escapeHtml(item.descripcion || '-')}</td><td>${dateHtml(item.created_at)}</td><td class="right">${item.tipo === 'retiro' ? '-' : '+'}${moneyHtml(item.monto)}</td></tr>`, 'Sin movimientos')
  const denominacionesRows = data.conteo ? Object.entries(data.conteo)
    .filter(([, cant]) => Number(cant) > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([valor, cant]) => `<div class="row"><span>$${Number(valor).toLocaleString('es-DO')} x ${cant}</span><span>${moneyHtml(Number(valor) * Number(cant))}</span></div>`)
    .join('') : ''
  const denominacionesHtml = denominacionesRows ? `<h2>CONTEO DE EFECTIVO</h2>${denominacionesRows}<div class="row total"><span>TOTAL CONTADO</span><span>${moneyHtml(totalConteo.value)}</span></div>` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page{size:80mm auto;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;width:76mm;margin:0;padding:3mm;color:#111;font-size:10px}
    h1{font-size:17px;margin:0;text-align:center}h2{font-size:12px;margin:10px 0 4px;padding-bottom:3px;border-bottom:1px dashed #555}
    .center{text-align:center}.muted{color:#555}.meta{margin-top:7px;line-height:1.45}.row{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
    .total{font-size:14px;font-weight:700;border-top:2px solid #111;border-bottom:2px solid #111;margin-top:4px;padding:6px 0}
    table{width:100%;border-collapse:collapse;font-size:8px}th,td{padding:3px 1px;border-bottom:1px dotted #aaa;text-align:left;vertical-align:top}.right{text-align:right;white-space:nowrap}.empty{text-align:center;color:#666;padding:6px}
    .footer{text-align:center;margin-top:12px;border-top:1px dashed #555;padding-top:8px;font-size:9px}
  </style></head><body>
    <h1>${empresaNombre}</h1>
    <div class="center muted">${escapeHtml(data.empresa.legal || '')}</div>
    <div class="center">${escapeHtml(data.empresa.direccion || '')}</div>
    <div class="center">${escapeHtml(data.empresa.telefono || '')}</div>
    <h2>CIERRE DE CAJA</h2>
    <div class="meta">
      <div class="row"><span>Turno</span><strong>#${escapeHtml(data.turno.id)}</strong></div>
      <div class="row"><span>Cajero</span><strong>${escapeHtml(data.turno.usuario_nombre || localStorage.getItem('mr_user_usuario') || 'Usuario')}</strong></div>
      <div class="row"><span>Apertura</span><span>${dateHtml(data.turno.created_at)}</span></div>
      <div class="row"><span>Cierre</span><span>${dateHtml(data.cerradoEn)}</span></div>
      <div class="row"><span>Duracion</span><span>${escapeHtml(data.duracion)}</span></div>
    </div>
    <h2>RESUMEN</h2>
    <div class="row"><span>Fondo inicial</span><span>${moneyHtml(data.turno.monto_inicial)}</span></div>
    <div class="row"><span>Ventas (${data.resumen.cantidad})</span><span>${moneyHtml(data.resumen.total)}</span></div>
    <div class="row"><span>Efectivo</span><span>${moneyHtml(data.resumen.efectivo)}</span></div>
    <div class="row"><span>Tarjeta</span><span>${moneyHtml(data.resumen.tarjeta)}</span></div>
    <div class="row"><span>Transferencia</span><span>${moneyHtml(data.resumen.transferencia)}</span></div>
    <div class="row"><span>Entradas</span><span>+${moneyHtml(data.totalEntradas)}</span></div>
    <div class="row"><span>Gastos</span><span>-${moneyHtml(data.totalGastos)}</span></div>
    <div class="row"><span>Retiros</span><span>-${moneyHtml(data.totalRetiros)}</span></div>
    <div class="row total"><span>EFECTIVO ESPERADO</span><span>${moneyHtml(data.efectivoEsperado)}</span></div>
    ${denominacionesHtml}
    <h2>VENTAS</h2><table><thead><tr><th>No.</th><th>Metodo</th><th>Fecha</th><th class="right">Total</th></tr></thead><tbody>${ventas}</tbody></table>
    <h2>GASTOS</h2><table><tbody>${gastos}</tbody></table>
    <h2>MOVIMIENTOS</h2><table><tbody>${movimientos}</tbody></table>
    ${data.turno.observacion ? `<h2>OBSERVACION</h2><div>${escapeHtml(data.turno.observacion)}</div>` : ''}
    <div class="footer">Documento generado por TMPOS SRL<br>Conserve este comprobante para fines de auditoria.</div>
  </body></html>`
}

function construirEmailCierre(data) {
  const empresaNombre = escapeHtml(data.empresa.nombre || data.empresa.legal || 'TMPOS SRL')
  const ventas = filasDetalle(data.ventas, venta => `
    <tr><td>${escapeHtml(venta.no_factura || venta.id)}</td><td>${escapeHtml(venta.nombre_cliente || 'Cliente General')}</td><td>${escapeHtml(venta.metodo_pago || 'Efectivo')}</td><td style="text-align:right">${moneyHtml(venta.total)}</td></tr>`, 'Sin ventas registradas')
  const gastos = filasDetalle(data.gastos, gasto => `
    <tr><td>${dateHtml(gasto.created_at)}</td><td>${escapeHtml(gasto.comentario || gasto.descripcion || 'Gasto')}</td><td style="text-align:right;color:#b91c1c">${moneyHtml(gasto.cantidad || gasto.monto)}</td><td></td></tr>`, 'Sin gastos registrados')
  const movimientos = filasDetalle([...data.entradas, ...data.retiros].sort((a, b) => parseDbDate(a.created_at) - parseDbDate(b.created_at)), item => `
    <tr><td>${dateHtml(item.created_at)}</td><td>${escapeHtml(String(item.tipo || '').toUpperCase())}</td><td>${escapeHtml(item.descripcion || '-')}</td><td style="text-align:right">${moneyHtml(item.monto)}</td></tr>`, 'Sin movimientos registrados')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
    <div style="max-width:760px;margin:0 auto;padding:24px">
      <div style="background:#064e3b;color:#fff;padding:28px;border-radius:14px 14px 0 0">
        <div style="font-size:13px;opacity:.8;letter-spacing:1px">REPORTE OFICIAL</div>
        <h1 style="margin:6px 0 4px;font-size:28px">Cierre de caja #${escapeHtml(data.turno.id)}</h1>
        <div>${empresaNombre} &bull; ${dateHtml(data.cerradoEn)}</div>
      </div>
      <div style="background:#fff;padding:26px;border-radius:0 0 14px 14px;box-shadow:0 8px 25px rgba(0,0,0,.08)">
        <table style="width:100%;margin-bottom:20px"><tr>
          <td><div style="color:#6b7280;font-size:12px">CAJERO</div><strong>${escapeHtml(data.turno.usuario_nombre || localStorage.getItem('mr_user_usuario') || 'Usuario')}</strong></td>
          <td><div style="color:#6b7280;font-size:12px">APERTURA</div><strong>${dateHtml(data.turno.created_at)}</strong></td>
          <td><div style="color:#6b7280;font-size:12px">DURACION</div><strong>${escapeHtml(data.duracion)}</strong></td>
        </tr></table>
        <table style="width:100%;border-spacing:8px"><tr>
          <td style="background:#ecfdf5;padding:16px;border-radius:10px"><div style="font-size:12px;color:#047857">VENTAS</div><strong style="font-size:20px">${moneyHtml(data.resumen.total)}</strong><div>${data.resumen.cantidad} transacciones</div></td>
          <td style="background:#eff6ff;padding:16px;border-radius:10px"><div style="font-size:12px;color:#1d4ed8">EFECTIVO ESPERADO</div><strong style="font-size:20px">${moneyHtml(data.efectivoEsperado)}</strong></td>
        </tr></table>
        <h2 style="font-size:17px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">Resumen financiero</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:7px">Fondo inicial</td><td style="text-align:right">${moneyHtml(data.turno.monto_inicial)}</td><td style="padding:7px">Ventas efectivo</td><td style="text-align:right">${moneyHtml(data.resumen.efectivo)}</td></tr>
          <tr><td style="padding:7px">Tarjeta</td><td style="text-align:right">${moneyHtml(data.resumen.tarjeta)}</td><td style="padding:7px">Transferencia</td><td style="text-align:right">${moneyHtml(data.resumen.transferencia)}</td></tr>
          <tr><td style="padding:7px">Entradas</td><td style="text-align:right;color:#047857">+${moneyHtml(data.totalEntradas)}</td><td style="padding:7px">Gastos</td><td style="text-align:right;color:#b91c1c">-${moneyHtml(data.totalGastos)}</td></tr>
          <tr><td style="padding:7px">Retiros</td><td style="text-align:right;color:#b91c1c">-${moneyHtml(data.totalRetiros)}</td><td style="padding:7px;font-weight:bold">Efectivo esperado</td><td style="text-align:right;font-weight:bold">${moneyHtml(data.efectivoEsperado)}</td></tr>
        </table>
        <h2 style="font-size:17px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">Ventas del turno</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f9fafb"><th style="padding:9px;text-align:left">Factura</th><th style="text-align:left">Cliente</th><th style="text-align:left">Metodo</th><th style="text-align:right">Total</th></tr></thead><tbody>${ventas}</tbody></table>
        <h2 style="font-size:17px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">Gastos</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${gastos}</tbody></table>
        <h2 style="font-size:17px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">Entradas y retiros</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${movimientos}</tbody></table>
        ${data.turno.observacion ? `<div style="margin-top:20px;padding:14px;background:#fffbeb;border-left:4px solid #f59e0b"><strong>Observacion:</strong> ${escapeHtml(data.turno.observacion)}</div>` : ''}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center">Reporte generado automaticamente por TMPOS SRL.</div>
      </div>
    </div>
  </body></html>`
}

function construirDatosApiCierre(data) {
  const texto = (value, limite = 160) => String(value || '').trim().slice(0, limite)
  const totalContado = Object.entries(data.conteo || {})
    .reduce((sum, [valor, cantidad]) => sum + (Number(valor) * Number(cantidad || 0)), 0)
  const mapVenta = venta => ({
    numero: texto(venta.no_factura || venta.id, 60),
    cliente: texto(venta.nombre_cliente || 'Cliente General'),
    metodo_pago: texto(venta.metodo_pago || 'EFECTIVO', 60),
    total: Number(venta.total || 0),
    fecha: texto(venta.created_at, 40),
  })
  const mapGasto = gasto => ({
    descripcion: texto(gasto.comentario || gasto.descripcion || 'Gasto'),
    metodo_pago: texto(gasto.metodo_pago || 'EFECTIVO', 60),
    monto: Number(gasto.cantidad || gasto.monto || 0),
    fecha: texto(gasto.created_at, 40),
  })
  const mapMovimiento = movimiento => ({
    tipo: texto(movimiento.tipo, 40).toUpperCase(),
    descripcion: texto(movimiento.descripcion),
    monto: Number(movimiento.monto || 0),
    fecha: texto(movimiento.created_at, 40),
  })

  return {
    company_name: texto(data.empresa.nombre || data.empresa.legal || 'TMPOS SRL'),
    company_legal_name: texto(data.empresa.legal),
    company_rnc: texto(data.empresa.rnc, 40),
    company_phone: texto(data.empresa.telefono, 60),
    company_address: texto(data.empresa.direccion, 240),
    shift_id: Number(data.turno.id || 0),
    cashier: texto(data.turno.usuario_nombre || localStorage.getItem('mr_user_usuario') || 'Usuario'),
    opened_at: texto(data.turno.created_at, 40),
    closed_at: texto(data.cerradoEn, 40),
    duration: texto(data.duracion, 40),
    opening_amount: Number(data.turno.monto_inicial || 0),
    sales_count: Number(data.resumen.cantidad || data.ventas.length || 0),
    sales_total: Number(data.resumen.total || 0),
    cash_sales: Number(data.resumen.efectivo || 0),
    card_sales: Number(data.resumen.tarjeta || 0),
    transfer_sales: Number(data.resumen.transferencia || 0),
    entries_total: Number(data.totalEntradas || 0),
    expenses_total: Number(data.totalGastos || 0),
    withdrawals_total: Number(data.totalRetiros || 0),
    expected_cash: Number(data.efectivoEsperado || 0),
    counted_cash: totalContado,
    difference: totalContado - Number(data.efectivoEsperado || 0),
    observation: texto(data.turno.observacion, 500),
    details_truncated: data.ventas.length > 50 || data.gastos.length > 50 || (data.entradas.length + data.retiros.length) > 50,
    sales: data.ventas.slice(0, 50).map(mapVenta),
    expenses: data.gastos.slice(0, 50).map(mapGasto),
    movements: [...data.entradas, ...data.retiros]
      .sort((a, b) => parseDbDate(a.created_at) - parseDbDate(b.created_at))
      .slice(0, 50)
      .map(mapMovimiento),
    cash_count: Object.entries(data.conteo || {})
      .filter(([, cantidad]) => Number(cantidad) > 0)
      .map(([denomination, quantity]) => ({
        denomination: Number(denomination),
        quantity: Number(quantity),
        total: Number(denomination) * Number(quantity),
      })),
  }
}

const totalConteo = computed(() => {
  let total = 0
  for (const d of denominaciones) {
    const cant = Number(conteo.value[d.valor]) || 0
    total += d.valor * cant
  }
  return total
})

const totalPiezas = computed(() => denominaciones.reduce(
  (total, d) => total + (Number(conteo.value[d.valor]) || 0),
  0,
))

function abrirCierreTurno() {
  if (!turnoActual.value) return
  conteo.value = {}
  cierreRevelado.value = !esCierreCiego.value
  showCierreModal.value = true
}

function declararConteo() {
  cierreRevelado.value = true
}

async function cerrarTurno() {
  if (cerrandoTurno.value || !turnoActual.value) return
  if (esCierreCiego.value && !cierreRevelado.value) return
  cerrandoTurno.value = true
  try {
    const cierre = await obtenerResumenCierre()
    const diferencia = totalConteo.value - cierre.efectivoEsperado
    const resultadoCierre = await window.db.update('caja_turnos', cierre.turno.id, {
      estado: 'cerrado',
      monto_final: totalConteo.value,
      efectivo_esperado: cierre.efectivoEsperado,
      diferencia,
      cierre_ciego: esCierreCiego.value ? 1 : 0,
    })
    if (!resultadoCierre.success) throw new Error(resultadoCierre.error || 'No se pudo cerrar el turno')

    await window.electron.invoke('cuadre:realizar', {
      turno_id: cierre.turno.id,
      turno_usuario: cierre.turno.usuario_nombre || '',
      monto_inicial: cierre.turno.monto_inicial || 0,
      total_ventas: cierre.resumen.total,
      efectivo: cierre.resumen.efectivo,
      tarjeta: cierre.resumen.tarjeta,
      transferencia: cierre.resumen.transferencia,
      total_gastos: cierre.totalGastos,
      saldo_final: cierre.efectivoEsperado,
      efectivo_esperado: cierre.efectivoEsperado,
      efectivo_contado: totalConteo.value,
      diferencia,
      cierre_ciego: esCierreCiego.value ? 1 : 0,
      observacion: '',
    })

    const ticketHtml = construirTicketCierre(cierre)
    const emailHtml = construirEmailCierre(cierre)
    const apiData = construirDatosApiCierre(cierre)
    const [impresionResult, correoResult] = await Promise.allSettled([
      window.electron.invoke('print:ticket', ticketHtml, cierre.impresora.printer_name || undefined),
      window.electron.invoke('enviar:cierreCaja', {
        toEmail: cierre.empresa.email || cierre.correo.email || '',
        subject: `Cierre de caja #${cierre.turno.id} - ${cierre.empresa.nombre || 'TMPOS SRL'}`,
        html: emailHtml,
        data: apiData,
      }),
    ])
    const impresion = impresionResult.status === 'fulfilled'
      ? impresionResult.value
      : { success: false, error: impresionResult.reason?.message || String(impresionResult.reason) }
    const correo = correoResult.status === 'fulfilled'
      ? correoResult.value
      : { success: false, error: correoResult.reason?.message || String(correoResult.reason) }

    turnoActual.value = null
    await cargarDatos()
    const mensajes = ['Turno cerrado correctamente.']
    mensajes.push(impresion?.success ? 'Ticket enviado a la impresora.' : `No se pudo imprimir: ${impresion?.error || 'Error desconocido'}`)
    mensajes.push(correo?.success
      ? `${correo.queued ? 'Reporte encolado' : 'Reporte enviado'} a ${correo.toEmail || cierre.empresa.email || cierre.correo.email} mediante ${correo.provider || 'correo'}.`
      : `No se pudo enviar el correo: ${correo?.error || 'Error desconocido'}`)
    alert(mensajes.join('\n'))
    auth.logout()
    await router.replace('/login')
  } catch (e) {
    console.error('Error cerrando turno:', e)
    alert('Error al cerrar el turno: ' + (e.message || 'Error desconocido'))
  } finally {
    cerrandoTurno.value = false
  }
}

function verDetalleVenta(v) {
  ventaSeleccionada.value = v
  showDetalleVenta.value = true
}

onMounted(() => {
  cargarDatos()
  refreshInterval = setInterval(cargarDatos, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>
