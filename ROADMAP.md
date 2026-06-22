# Roadmap - Sistema de Gestion para Tiendas de Celulares

## Estado actual del proyecto

### ✅ Implementado
- POS completo con metodos de pago, comision, comprobantes fiscales
- Inventario: Telefonos, Accesorios, Electrodomesticos, IMEI, Serial, Piezas
- CRM basico: Clientes, Proveedores
- Taller/Reparaciones: Ordenes de taller, Tecnicos
- Caja: Turnos, apertura/cierre, gastos, resumen de ventas
- Multi-almacen con datos segmentados
- Facturacion con comprobantes fiscales, NCF, tickets termicos, PDF
- Sincronizacion TM Cloud / Supabase
- Roles: Admin, Cajero, Vendedor, Soporte, Taller
- Impresion de etiquetas con codigo de barras y QR
- Composicion de precios por comision de metodo de pago
- Tema oscuro/claro
- Licencias y configuracion remota

---

## Pendiente por prioridad

### 🔴 PRIORIDAD INMEDIATA

#### 1. Dashboard / KPI ✅
- [x] Tarjetero con ventas del dia, mes y año
- [x] Productos mas vendidos (top 10)
- [x] Alertas de stock bajo visibles en dashboard
- [x] Resumen de caja del turno activo

#### 2. Reportes ✅
- [x] Reporte general con graficos (Chart.js)
- [x] Filtro por rango de fechas (hoy, ayer, semana, mes, año, personalizado)
- [x] Filtro por almacen
- [x] Exportar a PDF con graficos y tablas
- [x] Reportes DGII (606, 607), Gastos, Ventas, Ganancias

#### 3. Compras / Ordenes de Compra ✅
- [x] Tabla `ordenes_compra` en base de datos
- [x] Crear orden de compra con productos y proveedor
- [x] Recepcion de mercancia (marcar como RECIBIDA)
- [x] Detalle de orden

---

### 🟡 PRIORIDAD ALTA

#### 4. Transferencias entre Almacenes
- [ ] Mover inventario de un almacen a otro
- [ ] Registrar entrada/salida por transferencia
- [ ] Historial de transferencias

#### 5. Ajustes de Inventario
- [ ] Ajustar stock por perdida, robo, daño
- [ ] Justificacion del ajuste
- [ ] Aprobacion requerida (admin)

#### 6. Notificaciones y Alertas
- [ ] Alerta de stock bajo en dashboard y topbar
- [ ] Notificacion de cuentas por cobrar vencidas
- [ ] Alerta de garantias proximas a vencer

#### 7. Gestion de Garantias
- [ ] Registrar garantia al vender (IMEI/Serial)
- [ ] Seguimiento de reclamos de garantia
- [ ] Tiempo restante de garantia visible
- [ ] Historial de reclamos por cliente/producto

---

### 🟢 PRIORIDAD MEDIA

#### 8. Comisiones de Vendedores
- [ ] Registrar comision por venta (% o fijo)
- [ ] Reporte de comisiones por empleado
- [ ] Liquidacion de comisiones

#### 9. Cuentas por Cobrar / Pagar
- [ ] Gestion de cuentas por cobrar (tabla ya existe)
- [ ] Gestion de cuentas por pagar (tabla ya existe)
- [ ] Historial de pagos de clientes
- [ ] Recordatorios de pago automaticos

#### 10. Historial de Precios
- [ ] Tracking de cambios de precio por producto
- [ ] Precio anterior vs nuevo con fecha
- [ ] Quien realizo el cambio

#### 11. Tickets de Soporte al Cliente
- [ ] Ticket de reparacion con comunicacion al cliente
- [ ] Notificaciones de estado via WhatsApp
- [ ] Galeria de fotos del equipo (antes/despues)

---

### 🔵 PRIORIDAD FUTURA

#### 12. Facturacion Electronica (e-NCF) para RD
- [ ] Envio de comprobantes fiscales electronicos a la DGII
- [ ] Timbre fiscal / Codigo de validacion
- [ ] Reporte de comprobantes enviados vs pendientes

#### 13. Backup / Restore de Base de Datos
- [ ] Respaldar base de datos SQLite
- [ ] Restaurar desde backup
- [ ] Backup automatico programado (diario/semanal)

#### 14. Integracion con Pasarela de Pago
- [ ] Pagos con tarjeta en linea (Tpaga, APAP, Popular)
- [ ] QR de pago generado en factura
- [ ] Conciliacion automatica de pagos

#### 15. Programa de Lealtad / Puntos
- [ ] Puntos por compras
- [ ] Canje de puntos
- [ ] Historial de puntos por cliente

#### 16. Aplicacion Movil (Capacitor)
- [ ] Companion app para escanear IMEIs/Seriales
- [ ] Consulta de precios desde el movil
- [ ] Notificaciones push
