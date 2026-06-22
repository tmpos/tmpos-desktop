<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const toast = useToast()
const notas = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const selectedNota = ref<any>(null)
const form = ref({ titulo: '', contenido: '' })
const isEditing = ref(false)

async function cargarNotas() {
  loading.value = true
  try {
    const res = await window.db.getAll('notas')
    if (res.success) notas.value = res.data || []
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

function abrirCrear() {
  isEditing.value = false
  form.value = { titulo: '', contenido: '' }
  dialogVisible.value = true
}

function abrirEditar(nota: any) {
  isEditing.value = true
  selectedNota.value = nota
  form.value = { titulo: nota.titulo, contenido: nota.contenido || '' }
  dialogVisible.value = true
}

function confirmarBorrar(nota: any) {
  selectedNota.value = nota
  deleteDialogVisible.value = true
}

async function guardar() {
  if (!form.value.titulo.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El titulo es requerido', life: 3000 })
    return
  }

  const data = {
    titulo: form.value.titulo.trim().toUpperCase(),
    contenido: form.value.contenido.trim(),
  }

  try {
    if (isEditing.value) {
      const res = await window.db.update('notas', selectedNota.value.id, data)
      if (res.success) toast.add({ severity: 'success', summary: 'Exito', detail: 'Nota actualizada', life: 3000 })
    } else {
      const res = await window.db.insert('notas', data)
      if (res.success) toast.add({ severity: 'success', summary: 'Exito', detail: 'Nota creada', life: 3000 })
    }
    dialogVisible.value = false
    await cargarNotas()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar', life: 3000 })
  }
}

async function borrar() {
  try {
    const res = await window.db.delete('notas', selectedNota.value.id)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Exito', detail: 'Nota eliminada', life: 3000 })
    }
    deleteDialogVisible.value = false
    await cargarNotas()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar', life: 3000 })
  }
}

onMounted(cargarNotas)
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Notas">
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-surface-500">{{ notas.length }} nota(s) registradas</span>
        <Button label="Nueva Nota" icon="pi pi-plus" @click="abrirCrear" />
      </div>

      <DataTable
        :value="notas"
        :loading="loading"
        stripedRows
        paginator
        :rows="15"
        :rowsPerPageOptions="[15, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
      >
        <Column field="id" header="ID" style="width: 5rem" />
        <Column field="titulo" header="Titulo" sortable />
        <Column field="contenido" header="Contenido" sortable>
          <template #body="{ data }">
            <span class="text-surface-500 text-sm truncate block max-w-xs">{{ data.contenido || '-' }}</span>
          </template>
        </Column>
        <Column header="Acciones" style="width: 10rem">
          <template #body="{ data }">
            <div class="flex gap-2">
              <Button icon="pi pi-pencil" severity="info" text rounded @click="abrirEditar(data)" v-tooltip="'Editar'" />
              <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmarBorrar(data)" v-tooltip="'Eliminar'" />
            </div>
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay notas registradas.</div>
        </template>
      </DataTable>
    </Fieldset>

    <Dialog
      v-model:visible="dialogVisible"
      :header="isEditing ? 'Editar Nota' : 'Nueva Nota'"
      modal
      :style="{ width: '32rem' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Titulo</label>
          <InputText v-model="form.titulo" placeholder="Titulo de la nota" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Contenido</label>
          <Textarea v-model="form.contenido" placeholder="Contenido de la nota" fluid autoResize :rows="4" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardar" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Confirmar"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="flex items-center gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>Seguro que deseas eliminar <strong>{{ selectedNota?.titulo }}</strong>?</span>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button label="Eliminar" icon="pi pi-trash" severity="danger" @click="borrar" />
      </template>
    </Dialog>
  </div>
</template>
