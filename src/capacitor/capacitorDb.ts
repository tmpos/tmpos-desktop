import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { uuidv4 } from './util'
import { WASM_BASE64 } from './wasm'

const DB_FILE = 'mr_cutti_database.db'

let db: SqlJsDatabase | null = null
let isReady = false

function decodeBase64Wasm(): Uint8Array {
  const binaryStr = atob(WASM_BASE64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

async function saveDb() {
  if (!db) return
  try {
    const data = db.export()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)))
    await Filesystem.writeFile({
      path: DB_FILE,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    })
  } catch (e) {
    console.error('[capacitorDb] Error saving DB:', e)
  }
}

async function loadDb(): Promise<Uint8Array | null> {
  try {
    const result = await Filesystem.readFile({
      path: DB_FILE,
      directory: Directory.Data,
    })
    const data = result.data as string
    const binaryStr = atob(data)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

function generarUid(): string {
  return uuidv4()
}

function nowISO(): string {
  return new Date().toISOString()
}

export async function initDatabase(): Promise<void> {
  if (isReady) return

  const wasmBuffer = decodeBase64Wasm()
  const SQL = await initSqlJs({ wasmBinary: wasmBuffer.buffer as ArrayBuffer })
  const existingData = await loadDb()

  if (existingData) {
    db = new SQL.Database(existingData)
    createTables()
    migrateTables()
    auditSchema()
    await saveDb()
  } else {
    db = new SQL.Database()
    createTables()
    migrateTables()
    auditSchema()
    insertDefaultData()
    await saveDb()
  }

  isReady = true
}

function createTables() {
  if (!db) return

  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario TEXT DEFAULT '',
    email TEXT DEFAULT '',
    password TEXT DEFAULT '',
    pin TEXT DEFAULT '',
    patron TEXT DEFAULT '',
    pregunta_secreta TEXT DEFAULT '',
    respuesta TEXT DEFAULT '',
    fecha TEXT DEFAULT '',
    nivel_seguridad TEXT DEFAULT 'Usuario',
    intentos_login TEXT DEFAULT '',
    estado TEXT DEFAULT 'ACTIVADO',
    permisos TEXT DEFAULT '',
    restrinciones TEXT DEFAULT '',
    porciento TEXT DEFAULT '',
    imagen TEXT DEFAULT '',
    rol TEXT DEFAULT 'vendedor',
    ultimo_acceso TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS empresa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT DEFAULT '',
    legal TEXT DEFAULT '',
    encargado TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    email TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    logo TEXT DEFAULT '',
    impuesto REAL DEFAULT 18,
    impuesto_incluido INTEGER DEFAULT 0,
    moneda TEXT DEFAULT 'RD$',
    tipo_documento_defecto TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cedula TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    email TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    apodo TEXT DEFAULT '',
    precio_fijado TEXT DEFAULT '',
    limite_credito TEXT DEFAULT '',
    empresa TEXT DEFAULT '',
    cargo TEXT DEFAULT '',
    telefono_empresa TEXT DEFAULT '',
    direccion_empresa TEXT DEFAULT '',
    codigo TEXT DEFAULT '',
    rnc TEXT DEFAULT '',
    activo TEXT DEFAULT 'ACTIVO',
    nota TEXT DEFAULT '',
    imagen TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    rnc TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    email TEXT DEFAULT '',
    encargado TEXT DEFAULT '',
    cuenta_bancaria TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    estado TEXT DEFAULT 'activo',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS marcas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    estado TEXT DEFAULT 'activo',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS accesorios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    codigo_barra TEXT DEFAULT '',
    costo REAL DEFAULT 0,
    precio_venta REAL DEFAULT 0,
    precio_min REAL DEFAULT 0,
    precio_xmayor REAL DEFAULT 0,
    cantidad INTEGER DEFAULT 1,
    alerta INTEGER DEFAULT 10,
    marca INTEGER,
    categoria INTEGER,
    proveedor_id INTEGER DEFAULT 0,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS catalogo_cuentas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    subtipo TEXT DEFAULT '',
    naturaleza TEXT DEFAULT 'DEUDORA',
    saldo_inicial REAL DEFAULT 0,
    estado TEXT DEFAULT 'ACTIVA',
    descripcion TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
  db.run(`INSERT OR IGNORE INTO catalogo_cuentas (codigo,nombre,tipo,subtipo,naturaleza) VALUES
    ('1101','Caja General','ACTIVO','CORRIENTE','DEUDORA'),('1102','Bancos','ACTIVO','CORRIENTE','DEUDORA'),('1103','Cuentas por Cobrar','ACTIVO','CORRIENTE','DEUDORA'),('1201','Inventario','ACTIVO','CORRIENTE','DEUDORA'),
    ('2101','Cuentas por Pagar','PASIVO','CORRIENTE','ACREEDORA'),('3101','Capital','PATRIMONIO','CAPITAL','ACREEDORA'),
    ('4101','Ventas','INGRESOS','OPERACIONALES','ACREEDORA'),('5101','Costo de Ventas','GASTOS','OPERACIONALES','DEUDORA'),('5201','Gastos Operativos','GASTOS','OPERACIONALES','DEUDORA')`)

  db.run(`CREATE TABLE IF NOT EXISTS perdidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    referencia_id INTEGER NOT NULL,
    nombre TEXT DEFAULT '',
    codigo TEXT DEFAULT '',
    cantidad INTEGER DEFAULT 1,
    costo REAL DEFAULT 0,
    motivo TEXT DEFAULT '',
    fecha TEXT DEFAULT '',
    almacen_id INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'ACTIVA',
    detalle TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS telefonos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS imei (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    id_equi INTEGER,
    telefono_uid TEXT DEFAULT '',
    equipo TEXT DEFAULT '',
    costo REAL DEFAULT 0,
    precio_venta REAL DEFAULT 0,
    precio_min REAL DEFAULT 0,
    precio_xmayor REAL DEFAULT 0,
    color TEXT DEFAULT '',
    capacidad TEXT DEFAULT '',
    bateria TEXT DEFAULT '',
    estado TEXT DEFAULT 'DISPONIBLE',
    fecha_venta TEXT,
    comprador TEXT DEFAULT '',
    proveedor TEXT DEFAULT '',
    no_compra TEXT DEFAULT '',
    precio_vendido REAL DEFAULT 0,
    hora_venta TEXT DEFAULT '',
    no_factura TEXT DEFAULT '',
    nota TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS electrodomesticos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS serial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    id_equi INTEGER,
    costo REAL DEFAULT 0,
    precio_venta REAL DEFAULT 0,
    precio_min REAL DEFAULT 0,
    precio_xmayor REAL DEFAULT 0,
    color TEXT DEFAULT '',
    capacidad TEXT DEFAULT '',
    bateria TEXT DEFAULT '',
    estado TEXT DEFAULT 'DISPONIBLE',
    fecha_venta TEXT,
    comprador TEXT DEFAULT '',
    proveedor TEXT DEFAULT '',
    no_compra TEXT DEFAULT '',
    precio_vendido REAL DEFAULT 0,
    hora_venta TEXT DEFAULT '',
    no_factura TEXT DEFAULT '',
    nota TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cheque TEXT DEFAULT '',
    token TEXT DEFAULT '',
    cajero TEXT DEFAULT '',
    no_factura TEXT DEFAULT '',
    tipo_factura TEXT DEFAULT '',
    comprobante TEXT DEFAULT '',
    cod_cliente TEXT DEFAULT '',
    nombre_cliente TEXT DEFAULT '',
    telefono_cliente TEXT DEFAULT '',
    productos TEXT DEFAULT '',
    vendedor TEXT DEFAULT '',
    metodo_pago TEXT DEFAULT 'EFECTIVO',
    tarjeta REAL DEFAULT 0,
    transferencia REAL DEFAULT 0,
    efectivo REAL DEFAULT 0,
    canal_venta TEXT DEFAULT '',
    fecha_emision TEXT DEFAULT '',
    impuesto REAL DEFAULT 0,
    descuento REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    costo REAL DEFAULT 0,
    total REAL DEFAULT 0,
    ganancia REAL DEFAULT 0,
    financiera TEXT DEFAULT '',
    estado_factura TEXT DEFAULT 'PENDIENTE',
    fecha_estado TEXT DEFAULT '',
    mes TEXT DEFAULT '',
    year TEXT DEFAULT '',
    hora TEXT DEFAULT '',
    otro TEXT DEFAULT '',
    nota TEXT DEFAULT '',
    usuario TEXT DEFAULT '',
    identificadordb TEXT DEFAULT '',
    total_institucion REAL DEFAULT 0,
    total_cliente REAL DEFAULT 0,
    ncf TEXT DEFAULT '',
    tipo_comprobante TEXT DEFAULT '',
    comprobante_id INTEGER DEFAULT 0,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS piezas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    costo REAL DEFAULT 0,
    precio_venta REAL DEFAULT 0,
    cantidad INTEGER DEFAULT 0,
    alerta INTEGER DEFAULT 1,
    proveedor TEXT DEFAULT '',
    descripcion TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS tecnicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT DEFAULT '',
    email TEXT DEFAULT '',
    porcentaje REAL DEFAULT 0,
    estado TEXT DEFAULT 'ACTIVO',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS ordenes_taller (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_orden TEXT DEFAULT '',
    nombre TEXT NOT NULL,
    cedula TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    email TEXT DEFAULT '',
    equipo TEXT DEFAULT '',
    imei TEXT DEFAULT '',
    serial TEXT DEFAULT '',
    marca_modelo TEXT DEFAULT '',
    clave TEXT DEFAULT '',
    accesorios TEXT DEFAULT '',
    fallas TEXT DEFAULT '',
    piezas TEXT DEFAULT '',
    tecnico TEXT DEFAULT '',
    metodo_pago TEXT DEFAULT 'EFECTIVO',
    fecha_entrada TEXT,
    fecha_entrega TEXT,
    estado TEXT DEFAULT 'RECIBIDO',
    precio_pieza REAL DEFAULT 0,
    mano_obra REAL DEFAULT 0,
    abono REAL DEFAULT 0,
    pendiente REAL DEFAULT 0,
    total REAL DEFAULT 0,
    pagos TEXT DEFAULT '',
    beneficio_empresa REAL DEFAULT 0,
    beneficio_tecnico REAL DEFAULT 0,
    porcentaje_tecnico REAL DEFAULT 0,
    estado_pago_tecnico TEXT DEFAULT 'PENDIENTE',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS correo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT DEFAULT 'smtp.gmail.com',
    puerto TEXT DEFAULT '587',
    seguridad TEXT DEFAULT 'STARTTLS',
    email TEXT DEFAULT '',
    password TEXT DEFAULT '',
    nombre_remitente TEXT DEFAULT '',
    activo INTEGER DEFAULT 0,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cantidad REAL DEFAULT 0,
    fecha TEXT DEFAULT '',
    hora TEXT DEFAULT '',
    comentario TEXT DEFAULT '',
    turno_id INTEGER DEFAULT 0,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS gastos_fijos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    monto REAL DEFAULT 0,
    dia_pago INTEGER DEFAULT 1,
    categoria TEXT DEFAULT '',
    periodicidad TEXT DEFAULT 'MENSUAL',
    estado TEXT DEFAULT 'ACTIVO',
    descripcion TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS impresoras_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_name TEXT DEFAULT '',
    printer_model TEXT DEFAULT '',
    paper_width INTEGER DEFAULT 80,
    show_logo INTEGER DEFAULT 1,
    show_company_name INTEGER DEFAULT 1,
    show_legal INTEGER DEFAULT 1,
    show_phone INTEGER DEFAULT 1,
    show_address INTEGER DEFAULT 1,
    show_email INTEGER DEFAULT 1,
    show_cliente INTEGER DEFAULT 1,
    show_items INTEGER DEFAULT 1,
    show_totals INTEGER DEFAULT 1,
    show_barcode INTEGER DEFAULT 1,
    show_footer INTEGER DEFAULT 1,
    show_qr INTEGER DEFAULT 0,
    show_nota INTEGER DEFAULT 1,
    footer_text TEXT DEFAULT 'Gracias por su compra',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS cuentas_cobrar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_factura TEXT DEFAULT '',
    cod_cliente TEXT DEFAULT '',
    nombre_cliente TEXT DEFAULT '',
    telefono_cliente TEXT DEFAULT '',
    total REAL DEFAULT 0,
    abonado REAL DEFAULT 0,
    saldo REAL DEFAULT 0,
    fecha_venta TEXT DEFAULT '',
    fecha_vencimiento TEXT DEFAULT '',
    estado TEXT DEFAULT 'ACTIVA',
    notas TEXT DEFAULT '',
    pagos TEXT DEFAULT '[]',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS cuentas_pagar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_factura TEXT DEFAULT '',
    cod_proveedor TEXT DEFAULT '',
    nombre_proveedor TEXT DEFAULT '',
    telefono_proveedor TEXT DEFAULT '',
    total REAL DEFAULT 0,
    abonado REAL DEFAULT 0,
    saldo REAL DEFAULT 0,
    fecha_compra TEXT DEFAULT '',
    fecha_vencimiento TEXT DEFAULT '',
    estado TEXT DEFAULT 'ACTIVA',
    notas TEXT DEFAULT '',
    pagos TEXT DEFAULT '[]',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS bitacora (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT DEFAULT '',
    registro_id INTEGER DEFAULT 0,
    accion TEXT DEFAULT '',
    usuario TEXT DEFAULT '',
    datos_nuevos TEXT DEFAULT '',
    datos_anteriores TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT DEFAULT '',
    tipo TEXT DEFAULT 'string',
    categoria TEXT DEFAULT 'general',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS plantillas_etiquetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    ancho REAL DEFAULT 50,
    alto REAL DEFAULT 30,
    elementos TEXT DEFAULT '[]',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS licencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    licencia_equipo TEXT,
    licencia_cifrada TEXT,
    estado TEXT DEFAULT 'sin_verificar',
    nombre_empresa TEXT,
    fecha_inicio_prueba TEXT,
    fecha_vencimiento TEXT,
    ultima_verificacion TEXT,
    api_key TEXT,
    datos_servidor TEXT,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS sync_deletes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT NOT NULL,
    uid TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS comprobantes_fiscales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    prefijo TEXT DEFAULT '',
    secuencia_actual INTEGER DEFAULT 1,
    secuencia_desde INTEGER DEFAULT 1,
    secuencia_hasta INTEGER DEFAULT 99999999,
    fecha_vencimiento TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    es_default INTEGER DEFAULT 0,
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    contenido TEXT DEFAULT '',
    uid TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
}

function migrateTables() {
  if (!db) return
  const gastosInfo = db.exec('PRAGMA table_info("gastos")')
  const gastosColumns = new Set(
    (gastosInfo[0]?.values || []).map((row: any[]) => String(row[1]))
  )
  if (!gastosColumns.has('turno_id')) {
    db.run('ALTER TABLE gastos ADD COLUMN turno_id INTEGER DEFAULT 0')
  }
  const empresaInfo = db.exec('PRAGMA table_info("empresa")')
  const empresaColumns = new Set(
    (empresaInfo[0]?.values || []).map((row: any[]) => String(row[1]))
  )
  if (!empresaColumns.has('encargado')) {
    db.run(`ALTER TABLE empresa ADD COLUMN encargado TEXT DEFAULT ''`)
  }
  const facturasInfo = db.exec('PRAGMA table_info("facturas")')
  const facturasColumns = new Set(
    (facturasInfo[0]?.values || []).map((row: any[]) => String(row[1]))
  )
  if (!facturasColumns.has('costo')) {
    db.run('ALTER TABLE facturas ADD COLUMN costo REAL DEFAULT 0')
  }
  if (!facturasColumns.has('ganancia')) {
    db.run('ALTER TABLE facturas ADD COLUMN ganancia REAL DEFAULT 0')
  }
  const imeiInfo = db.exec('PRAGMA table_info("imei")')
  const imeiColumns = new Set(
    (imeiInfo[0]?.values || []).map((row: any[]) => String(row[1]))
  )
  if (!imeiColumns.has('telefono_uid')) {
    db.run("ALTER TABLE imei ADD COLUMN telefono_uid TEXT DEFAULT ''")
    db.run(`UPDATE imei SET telefono_uid = (SELECT uid FROM telefonos WHERE telefonos.id = imei.id_equi) WHERE id_equi IS NOT NULL`)
  }
  if (!imeiColumns.has('equipo')) {
    db.run("ALTER TABLE imei ADD COLUMN equipo TEXT DEFAULT ''")
    db.run(`UPDATE imei SET equipo = (SELECT nombre FROM telefonos WHERE telefonos.id = imei.id_equi) WHERE id_equi IS NOT NULL`)
  }
}

// Misma auditoria de esquema para instalaciones moviles/Capacitor.
function auditSchema() {
  if (!db) return
  const expected: Record<string, Record<string, string>> = {
    empresa: { encargado: "TEXT DEFAULT ''", logo: "TEXT DEFAULT ''", impuesto: 'REAL DEFAULT 18', impuesto_incluido: 'INTEGER DEFAULT 0', moneda: "TEXT DEFAULT 'RD$'", almacen_id: 'INTEGER DEFAULT 0' },
    telefonos: { imagen: "TEXT DEFAULT ''", almacen_id: 'INTEGER DEFAULT 0' },
    imei: { telefono_uid: "TEXT DEFAULT ''", equipo: "TEXT DEFAULT ''", costo: 'REAL DEFAULT 0', precio_venta: 'REAL DEFAULT 0', precio_min: 'REAL DEFAULT 0', precio_xmayor: 'REAL DEFAULT 0', estado: "TEXT DEFAULT 'DISPONIBLE'", almacen_id: 'INTEGER DEFAULT 0' },
    accesorios: { imagen: "TEXT DEFAULT ''", no_compra: "TEXT DEFAULT ''", proveedor_id: 'INTEGER DEFAULT 0', almacen_id: 'INTEGER DEFAULT 0' },
    facturas: { costo: 'REAL DEFAULT 0', ganancia: 'REAL DEFAULT 0', financiera: "TEXT DEFAULT ''", turno_id: 'INTEGER DEFAULT 0', almacen_id: 'INTEGER DEFAULT 0' },
    clientes: { imagen: "TEXT DEFAULT ''", rnc: "TEXT DEFAULT ''", almacen_id: 'INTEGER DEFAULT 0' },
    ordenes_taller: { imagen: "TEXT DEFAULT ''", pagos: "TEXT DEFAULT '[]'", almacen_id: 'INTEGER DEFAULT 0' },
  }
  db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, aplicado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, detalle TEXT DEFAULT '')`)
  for (const [table, columns] of Object.entries(expected)) {
    const info = db.exec(`PRAGMA table_info(${escapeId(table)})`)
    if (!info.length) continue
    const existing = new Set((info[0]?.values || []).map((row: any[]) => String(row[1])))
    for (const [column, definition] of Object.entries(columns)) {
      if (!existing.has(column)) db.run(`ALTER TABLE ${escapeId(table)} ADD COLUMN ${escapeId(column)} ${definition}`)
    }
  }
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  for (const row of tables[0]?.values || []) {
    const table = String(row[0])
    if (table === 'schema_migrations') continue
    const info = db.exec(`PRAGMA table_info(${escapeId(table)})`)
    const existing = new Set((info[0]?.values || []).map((column: any[]) => String(column[1])))
    if (!existing.has('almacen_id')) db.run(`ALTER TABLE ${escapeId(table)} ADD COLUMN almacen_id INTEGER DEFAULT 0`)
    if (!existing.has('uid')) db.run(`ALTER TABLE ${escapeId(table)} ADD COLUMN uid TEXT DEFAULT ''`)
    if (!existing.has('created_at')) db.run(`ALTER TABLE ${escapeId(table)} ADD COLUMN created_at TEXT DEFAULT ''`)
    if (!existing.has('updated_at')) db.run(`ALTER TABLE ${escapeId(table)} ADD COLUMN updated_at TEXT DEFAULT ''`)
  }
  db.run(`INSERT OR REPLACE INTO schema_migrations (version, detalle) VALUES (20260714, 'Auditoria automatica de columnas')`)
}

function insertDefaultData() {
  if (!db) return

  // Default users
  const userCheck = db.exec("SELECT id FROM usuarios WHERE email = 'admin' LIMIT 1")
  if (userCheck.length === 0 || userCheck[0].values.length === 0) {
    const defaults = [
      { nombre: 'ADMINISTRADOR', email: 'admin', pin: '1234', nivel_seguridad: 'Administrador' },
      { nombre: 'USUARIO', email: 'usuario', pin: '1111', nivel_seguridad: 'Usuario' },
      { nombre: 'SOPORTE', email: 'soporte', pin: '2222', nivel_seguridad: 'Soporte' },
    ]
    for (const user of defaults) {
      const uid = generarUid()
      db.run(
        `INSERT INTO usuarios (nombre, email, password, pin, nivel_seguridad, estado, uid, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, 'ACTIVADO', ?, datetime('now'), datetime('now'))`,
        [user.nombre, user.email, user.pin, user.nivel_seguridad, uid]
      )
    }
  }

  // Default company
  const empCheck = db.exec("SELECT id FROM empresa LIMIT 1")
  if (empCheck.length === 0 || empCheck[0].values.length === 0) {
    const uid = generarUid()
    db.run(`INSERT INTO empresa (nombre, uid, created_at, updated_at) VALUES ('MI EMPRESA', ?, datetime('now'), datetime('now'))`, [uid])
  }

  // Default license
  const licCheck = db.exec("SELECT id FROM licencia WHERE id = 1 LIMIT 1")
  if (licCheck.length === 0 || licCheck[0].values.length === 0) {
    const uid = generarUid()
    db.run(`INSERT INTO licencia (id, estado, uid, created_at, updated_at) VALUES (1, 'sin_verificar', ?, datetime('now'), datetime('now'))`, [uid])
  }

  // Default printer config
  const printCheck = db.exec("SELECT id FROM impresoras_config WHERE id = 1 LIMIT 1")
  if (printCheck.length === 0 || printCheck[0].values.length === 0) {
    const uid = generarUid()
    db.run(`INSERT INTO impresoras_config (id, uid, created_at, updated_at) VALUES (1, ?, datetime('now'), datetime('now'))`, [uid])
  }

  // Default comprobantes
  const compCheck = db.exec("SELECT COUNT(*) as c FROM comprobantes_fiscales")
  if (compCheck.length === 0 || Number(compCheck[0].values[0]) === 0) {
    const comprobantes = [
      ['SIN', 'Sin Comprobante', 'Venta sin comprobante fiscal', '', 1, 1, 99999999, 1, 0],
      ['E31', 'Factura de Credito Fiscal', 'Ventas a contribuyentes con RNC', 'E31', 1, 1, 99999999, 1, 0],
      ['E32', 'Factura de Consumo', 'Ventas a consumidores finales', 'E32', 1, 1, 99999999, 1, 1],
      ['E33', 'Nota de Debito', 'Cargos adicionales', 'E33', 1, 1, 99999999, 1, 0],
      ['E34', 'Nota de Credito', 'Devoluciones y descuentos', 'E34', 1, 1, 99999999, 1, 0],
      ['E41', 'Compras', 'Comprobante de compras', 'E41', 1, 1, 99999999, 1, 0],
      ['E43', 'Gastos Menores', 'Gastos menores sin comprobante', 'E43', 1, 1, 99999999, 1, 0],
      ['E44', 'Regimenes Especiales', 'Ventas a zonas francas', 'E44', 1, 1, 99999999, 1, 0],
      ['E45', 'Gubernamental', 'Ventas al gobierno', 'E45', 1, 1, 99999999, 1, 0],
      ['E46', 'Exportacion', 'Ventas al exterior', 'E46', 1, 1, 99999999, 1, 0],
      ['E47', 'Pagos al Exterior', 'Pagos a proveedores extranjeros', 'E47', 1, 1, 99999999, 1, 0],
    ]
    for (const c of comprobantes) {
      const uid = generarUid()
      db.run(
        `INSERT INTO comprobantes_fiscales (tipo, nombre, descripcion, prefijo, secuencia_actual, secuencia_desde, secuencia_hasta, activo, es_default, uid, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [...c, uid]
      )
    }
  }

  // Default notas
  const notasCheck = db.exec("SELECT COUNT(*) as total FROM notas")
  if (notasCheck.length === 0 || Number(notasCheck[0].values[0]) === 0) {
    const notas = [
      ['SIN SELLO', 'Sin sello de fabrica'],
      ['CAMBIO', 'Cambio del producto'],
      ['GARANTIA', 'Garantia del producto'],
      ['ENTREGADO', 'Producto entregado al cliente'],
      ['REPARACION', 'Reparacion del equipo'],
      ['A DOMICILIO', 'Envio a domicilio'],
      ['CON FACTURA', 'Venta con factura fiscal'],
      ['SIN FACTURA', 'Venta sin factura fiscal'],
      ['PENDIENTE', 'Pendiente por entregar'],
      ['OBSERVACION', 'Observacion general'],
    ]
    for (const [titulo, contenido] of notas) {
      const uid = generarUid()
      db.run(`INSERT INTO notas (titulo, contenido, uid, created_at) VALUES (?, ?, ?, datetime('now'))`, [titulo, contenido, uid])
    }
  }
}

// ========== DB API ==========

function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized')
  return db
}

function escapeId(id: string): string {
  return `"${id.replace(/"/g, '""')}"`
}

export function dbGetAll(tabla: string): { success: boolean; data?: any[]; error?: string } {
  try {
    const stmt = getDb().prepare(`SELECT * FROM ${escapeId(tabla)} ORDER BY id DESC`)
    const rows: any[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return { success: true, data: rows }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbGetModified(tabla: string, desde: string): { success: boolean; data?: any[]; error?: string } {
  try {
    const d = getDb()
    let rows: any[]
    if (desde) {
      const stmt = d.prepare(`SELECT * FROM ${escapeId(tabla)} WHERE updated_at > ? ORDER BY updated_at ASC`)
      stmt.bind([desde])
      rows = []
      while (stmt.step()) {
        rows.push(stmt.getAsObject())
      }
      stmt.free()
    } else {
      const stmt = d.prepare(`SELECT * FROM ${escapeId(tabla)} ORDER BY id DESC`)
      rows = []
      while (stmt.step()) {
        rows.push(stmt.getAsObject())
      }
      stmt.free()
    }
    return { success: true, data: rows }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbGetById(tabla: string, id: number): { success: boolean; data?: any; error?: string } {
  try {
    const stmt = getDb().prepare(`SELECT * FROM ${escapeId(tabla)} WHERE id = ?`)
    stmt.bind([id])
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    return { success: true, data: row }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbInsert(tabla: string, data: Record<string, any>): { success: boolean; data?: { id: number }; error?: string } {
  try {
    const d = getDb()
    if (!data.uid) data.uid = generarUid()
    data.created_at = data.created_at || nowISO()
    data.updated_at = nowISO()

    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data[k])

    d.run(`INSERT INTO ${escapeId(tabla)} (${keys.map(escapeId).join(', ')}) VALUES (${placeholders})`, values)
    const result = d.exec('SELECT last_insert_rowid() as id')
    const newId = result[0]?.values[0]?.[0] || 0

    if (tabla !== 'bitacora' && tabla !== 'sync_deletes') {
      try {
        const uid = data.uid || ''
        const usuario = data.usuario || ''
        d.run(
          `INSERT INTO bitacora (tabla, registro_id, accion, usuario, datos_nuevos, created_at) VALUES (?, ?, 'CREATE', ?, ?, datetime('now'))`,
          [tabla, Number(newId), usuario, JSON.stringify(data)]
        )
      } catch {}
    }

    saveDb()
    return { success: true, data: { id: Number(newId) } }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbUpdate(tabla: string, id: number, data: Record<string, any>): { success: boolean; error?: string } {
  try {
    const d = getDb()

    const oldStmt = d.prepare(`SELECT * FROM ${escapeId(tabla)} WHERE id = ?`)
    oldStmt.bind([id])
    const oldData = oldStmt.step() ? oldStmt.getAsObject() : {}
    oldStmt.free()

    data.updated_at = nowISO()
    const keys = Object.keys(data)
    const sets = keys.map(k => `${escapeId(k)} = ?`).join(', ')
    const values = [...keys.map(k => data[k]), id]

    d.run(`UPDATE ${escapeId(tabla)} SET ${sets} WHERE id = ?`, values)

    if (tabla !== 'bitacora' && tabla !== 'sync_deletes') {
      try {
        const usuario = data.usuario || ''
        d.run(
          `INSERT INTO bitacora (tabla, registro_id, accion, usuario, datos_nuevos, datos_anteriores, created_at) VALUES (?, ?, 'UPDATE', ?, ?, ?, datetime('now'))`,
          [tabla, id, usuario, JSON.stringify(data), JSON.stringify(oldData)]
        )
      } catch {}
    }

    saveDb()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbDelete(tabla: string, id: number, usuario?: string): { success: boolean; error?: string } {
  try {
    const d = getDb()

    const oldStmt = d.prepare(`SELECT * FROM ${escapeId(tabla)} WHERE id = ?`)
    oldStmt.bind([id])
    const oldData = oldStmt.step() ? oldStmt.getAsObject() : {}
    oldStmt.free()

    const uid = oldData?.uid || ''
    d.run(`DELETE FROM ${escapeId(tabla)} WHERE id = ?`, [id])

    if (tabla !== 'bitacora' && tabla !== 'sync_deletes') {
      try {
        d.run(
          `INSERT INTO bitacora (tabla, registro_id, accion, usuario, datos_anteriores, created_at) VALUES (?, ?, 'DELETE', ?, ?, datetime('now'))`,
          [tabla, id, usuario || '', JSON.stringify(oldData)]
        )
        if (uid) {
          d.run(`INSERT INTO sync_deletes (tabla, uid) VALUES (?, ?)`, [tabla, uid])
        }
      } catch {}
    }

    saveDb()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbBitacoraList(limite = 1000): { success: boolean; data?: any[]; error?: string } {
  try {
    const stmt = getDb().prepare('SELECT * FROM bitacora ORDER BY id DESC LIMIT ?')
    stmt.bind([limite])
    const rows: any[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return { success: true, data: rows }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbBitacoraDeleteAll(): { success: boolean; error?: string } {
  try {
    getDb().run('DELETE FROM bitacora')
    saveDb()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbExecuteSQL(sql: string): { success: boolean; type?: string; rows?: any[]; columns?: string[]; count?: number; changes?: number; error?: string } {
  try {
    const d = getDb()
    const upper = sql.trim().toUpperCase()
    if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('EXPLAIN')) {
      const stmt = d.prepare(sql)
      const rows: any[] = []
      while (stmt.step()) {
        rows.push(stmt.getAsObject())
      }
      stmt.free()
      const columns = rows.length > 0 ? Object.keys(rows[0]) : []
      return { success: true, type: 'select', rows, columns, count: rows.length }
    } else {
      d.run(sql)
      saveDb()
      return { success: true, type: 'execute', changes: d.getRowsModified() }
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbGetTableColumns(tabla: string): any[] {
  try {
    const result = getDb().exec(`PRAGMA table_info("${tabla}")`)
    if (result.length === 0) return []
    return result[0].values.map((row: any) => ({
      name: row[1],
      type: row[2],
      notnull: row[3],
      dflt_value: row[4],
    }))
  } catch {
    return []
  }
}

export function dbGetAllTables(): string[] {
  try {
    const result = getDb().exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    if (result.length === 0) return []
    return result[0].values.map((row: any) => row[0])
  } catch {
    return []
  }
}

export function dbTableExists(tabla: string): boolean {
  try {
    const result = getDb().exec(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tabla])
    return result.length > 0 && result[0].values.length > 0
  } catch {
    return false
  }
}

export function dbRawQuery(sql: string): { success: boolean; error?: string } {
  try {
    getDb().run(sql)
    saveDb()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbVaciarTabla(tabla: string): { success: boolean; error?: string } {
  try {
    const d = getDb()
    d.run(`DELETE FROM "${tabla}"`)
    d.run(`DELETE FROM sqlite_sequence WHERE name='${tabla}'`)
    saveDb()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbEliminarTabla(tabla: string): { success: boolean; error?: string } {
  try {
    getDb().run(`DROP TABLE IF EXISTS "${tabla}"`)
    saveDb()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function dbGetTableRowCount(tabla: string): number {
  try {
    const result = getDb().exec(`SELECT COUNT(*) as count FROM "${tabla}"`)
    return Number(result[0]?.values[0]?.[0]) || 0
  } catch {
    return 0
  }
}

export function dbGetCreateTableSQL(tabla: string): string {
  try {
    const result = getDb().exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [tabla])
    return (result[0]?.values[0]?.[0] as string) || ''
  } catch {
    return ''
  }
}

export function dbGetConfig(): { VITE_LINKURL: string; VITE_LINK_API: string; VITE_TOKEN: string; VITE_PATRON_TELEFONO: string; VITE_IMPRESORA_LOCAL: string; VITE_PATRON_CEDULA: string; VITE_TOKEN_CORTO: string } {
  return {
    VITE_LINKURL: '',
    VITE_LINK_API: '',
    VITE_TOKEN: '',
    VITE_PATRON_TELEFONO: '^[0-9]{10}$',
    VITE_IMPRESORA_LOCAL: '',
    VITE_PATRON_CEDULA: '^[0-9]{11}$',
    VITE_TOKEN_CORTO: '',
  }
}
