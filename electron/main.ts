import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { join } from 'path'
import { exec, execSync, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import http from 'http'
import https from 'https'
import net from 'net'
import tls from 'tls'
import { networkInterfaces, hostname } from 'os'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { getMachineId, getMachineIdLegacy } from './machine-id'

let mainWindow: BrowserWindow | null = null
let db: InstanceType<typeof Database> | null = null

function getDbPath(): string {
  const dbDir = path.join(app.getPath('userData'), 'database')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  return path.join(dbDir, 'database.db')
}

function getBackupsDir(): string {
  const backupsDir = path.join(app.getPath('userData'), 'backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }
  return backupsDir
}

async function pruneBackups(maxBackups = 5): Promise<void> {
  const backupsDir = getBackupsDir()
  const files = await fs.promises.readdir(backupsDir)
  const backups = await Promise.all(
    files
      .filter(file => file.toLowerCase().endsWith('.db'))
      .map(async file => {
        const filePath = path.join(backupsDir, file)
        const stat = await fs.promises.stat(filePath)
        return { filePath, mtime: stat.mtime.getTime() }
      })
  )
  backups.sort((a, b) => b.mtime - a.mtime)
  const toDelete = backups.slice(maxBackups)
  await Promise.all(toDelete.map(backup => fs.promises.unlink(backup.filePath)))
}

function generarUid(): string {
  return crypto.randomUUID()
}

function initDatabase(): void {
  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Asegurar uid, created_at y updated_at en TODAS las tablas existentes
  // Y poblar uid para registros existentes que no tengan
  {
    const tablas = db!.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as any[]
    for (const t of tablas) {
      try {
        const cols = db!.prepare(`PRAGMA table_info("${t.name}")`).all() as any[]
        if (!cols.some((c: any) => c.name === 'uid')) {
          db!.exec(`ALTER TABLE "${t.name}" ADD COLUMN "uid" TEXT DEFAULT ''`)
        }
        if (!cols.some((c: any) => c.name === 'created_at')) {
          db!.exec(`ALTER TABLE "${t.name}" ADD COLUMN "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
        }
        if (!cols.some((c: any) => c.name === 'updated_at')) {
          db!.exec(`ALTER TABLE "${t.name}" ADD COLUMN "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
        }
        // Poblar uid para registros existentes que tengan uid vacio o NULL
        const rowsSinUid = db!.prepare(`SELECT id FROM "${t.name}" WHERE uid IS NULL OR uid = ''`).all() as any[]
        if (rowsSinUid.length > 0) {
          const update = db!.prepare(`UPDATE "${t.name}" SET uid = ? WHERE id = ?`)
          for (const row of rowsSinUid) {
            update.run(generarUid(), row.id)
          }
        }
      } catch {}
    }
  }

  function tableExists(tabla: string): boolean {
    const result = db!.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tabla)
    return !!result
  }

  function tableColumns(tabla: string): string[] {
    return db!.prepare(`PRAGMA table_info("${tabla}")`).all().map((col: any) => col.name)
  }

  function ensureProveedoresTable(): void {
    if (tableExists('proveedores')) {
      const columns = tableColumns('proveedores')
      if (!columns.includes('id')) {
        const copyColumns = ['nombre', 'rnc', 'telefono', 'email', 'encargado', 'cuenta_bancaria', 'direccion']
          .filter(column => columns.includes(column))
        db!.exec(`ALTER TABLE proveedores RENAME TO proveedores_old`)
        db!.exec(`CREATE TABLE proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,rnc TEXT DEFAULT '',telefono TEXT DEFAULT '',email TEXT DEFAULT '',encargado TEXT DEFAULT '',cuenta_bancaria TEXT DEFAULT '',direccion TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO proveedores (${columnsSql}) SELECT ${columnsSql} FROM proveedores_old`)
        }
        db!.exec('DROP TABLE proveedores_old')
        return
      }
      for (const column of ['rnc', 'telefono', 'email', 'encargado', 'cuenta_bancaria', 'direccion', 'created_at', 'updated_at']) {
        if (!columns.includes(column)) db!.exec(`ALTER TABLE proveedores ADD COLUMN "${column}" TEXT DEFAULT ''`)
      }
      return
    }
    db!.exec(`CREATE TABLE proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,rnc TEXT DEFAULT '',telefono TEXT DEFAULT '',email TEXT DEFAULT '',encargado TEXT DEFAULT '',cuenta_bancaria TEXT DEFAULT '',direccion TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  }

  function ensureClientesTable(): void {
    const requiredColumns = ['cedula', 'telefono', 'whatsapp', 'email', 'direccion', 'apodo', 'precio_fijado', 'limite_credito', 'empresa', 'cargo', 'telefono_empresa', 'direccion_empresa', 'codigo', 'rnc', 'activo', 'nota', 'created_at', 'updated_at']
    if (tableExists('clientes')) {
      const columns = tableColumns('clientes')
      if (!columns.includes('id')) {
        const copyColumns = ['nombre', ...requiredColumns].filter(column => columns.includes(column))
        db!.exec(`ALTER TABLE clientes RENAME TO clientes_old`)
        db!.exec(`CREATE TABLE clientes (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,cedula TEXT DEFAULT '',telefono TEXT DEFAULT '',whatsapp TEXT DEFAULT '',email TEXT DEFAULT '',direccion TEXT DEFAULT '',apodo TEXT DEFAULT '',precio_fijado TEXT DEFAULT '',limite_credito TEXT DEFAULT '',empresa TEXT DEFAULT '',cargo TEXT DEFAULT '',telefono_empresa TEXT DEFAULT '',direccion_empresa TEXT DEFAULT '',codigo TEXT DEFAULT '',rnc TEXT DEFAULT '',activo TEXT DEFAULT 'ACTIVO',nota TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO clientes (${columnsSql}) SELECT ${columnsSql} FROM clientes_old`)
        }
        db!.exec('DROP TABLE clientes_old')
        return
      }
      for (const column of requiredColumns) {
        if (!columns.includes(column)) db!.exec(`ALTER TABLE clientes ADD COLUMN "${column}" TEXT DEFAULT ''`)
      }
      return
    }
    db!.exec(`CREATE TABLE clientes (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,cedula TEXT DEFAULT '',telefono TEXT DEFAULT '',whatsapp TEXT DEFAULT '',email TEXT DEFAULT '',direccion TEXT DEFAULT '',apodo TEXT DEFAULT '',precio_fijado TEXT DEFAULT '',limite_credito TEXT DEFAULT '',empresa TEXT DEFAULT '',cargo TEXT DEFAULT '',telefono_empresa TEXT DEFAULT '',direccion_empresa TEXT DEFAULT '',codigo TEXT DEFAULT '',rnc TEXT DEFAULT '',activo TEXT DEFAULT 'ACTIVO',nota TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  }

  function ensureUsuariosTable(): void {
    const requiredColumns = ['usuario', 'email', 'password', 'pin', 'patron', 'pregunta_secreta', 'respuesta', 'fecha', 'nivel_seguridad', 'intentos_login', 'estado', 'permisos', 'restrinciones', 'porciento', 'imagen', 'rol', 'ultimo_acceso', 'created_at', 'updated_at']
    if (tableExists('usuarios')) {
      const columns = tableColumns('usuarios')
      if (!columns.includes('id')) {
        const copyColumns = ['nombre', ...requiredColumns].filter(column => columns.includes(column))
        db!.exec(`ALTER TABLE usuarios RENAME TO usuarios_old`)
        db!.exec(`CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,usuario TEXT DEFAULT '',email TEXT DEFAULT '',password TEXT DEFAULT '',pin TEXT DEFAULT '',patron TEXT DEFAULT '',pregunta_secreta TEXT DEFAULT '',respuesta TEXT DEFAULT '',fecha TEXT DEFAULT '',nivel_seguridad TEXT DEFAULT 'Usuario',intentos_login TEXT DEFAULT '',estado TEXT DEFAULT 'ACTIVADO',permisos TEXT DEFAULT '',restrinciones TEXT DEFAULT '',porciento TEXT DEFAULT '',imagen TEXT DEFAULT '',rol TEXT DEFAULT 'vendedor',ultimo_acceso TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO usuarios (${columnsSql}) SELECT ${columnsSql} FROM usuarios_old`)
        }
        db!.exec('DROP TABLE usuarios_old')
      } else {
        for (const column of requiredColumns) {
          if (!columns.includes(column)) db!.exec(`ALTER TABLE usuarios ADD COLUMN "${column}" TEXT DEFAULT ''`)
        }
      }
    } else {
      db!.exec(`CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,usuario TEXT DEFAULT '',email TEXT DEFAULT '',password TEXT DEFAULT '',pin TEXT DEFAULT '',patron TEXT DEFAULT '',pregunta_secreta TEXT DEFAULT '',respuesta TEXT DEFAULT '',fecha TEXT DEFAULT '',nivel_seguridad TEXT DEFAULT 'Usuario',intentos_login TEXT DEFAULT '',estado TEXT DEFAULT 'ACTIVADO',permisos TEXT DEFAULT '',restrinciones TEXT DEFAULT '',porciento TEXT DEFAULT '',imagen TEXT DEFAULT '',rol TEXT DEFAULT 'vendedor',ultimo_acceso TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    }

    const defaults = [
      { nombre: 'ADMINISTRADOR', email: 'admin', pin: '1234', nivel_seguridad: 'Administrador', rol: 'admin' },
      { nombre: 'CAJERO', email: 'cajero', pin: '0000', nivel_seguridad: 'Cajero', rol: 'cajero' },
      { nombre: 'USUARIO', email: 'usuario', pin: '1111', nivel_seguridad: 'Usuario', rol: 'vendedor' },
      { nombre: 'SOPORTE', email: 'soporte', pin: '2222', nivel_seguridad: 'Soporte', rol: 'soporte' },
    ]
    const stmtExists = db!.prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1')
    const stmtInsert = db!.prepare(`INSERT INTO usuarios (nombre, email, password, pin, patron, pregunta_secreta, respuesta, fecha, nivel_seguridad, intentos_login, estado, permisos, restrinciones, porciento, imagen, rol, uid, created_at, updated_at) VALUES (?, ?, '', ?, '', '', '', '', ?, '', 'ACTIVADO', '', '', '', '', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
    for (const user of defaults) {
      if (!stmtExists.get(user.email)) stmtInsert.run(user.nombre, user.email, user.pin, user.nivel_seguridad, user.rol, generarUid())
    }
  }

  function ensurePiezasTable(): void {
    if (tableExists('piezas')) {
      const columns = tableColumns('piezas')
      if (!columns.includes('id')) {
        db!.exec(`ALTER TABLE piezas RENAME TO piezas_old`)
        db!.exec(`CREATE TABLE piezas (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,costo REAL DEFAULT 0,precio_venta REAL DEFAULT 0,cantidad INTEGER DEFAULT 0,alerta INTEGER DEFAULT 1,proveedor TEXT DEFAULT '',descripcion TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        const copyColumns = ['nombre', 'costo', 'precio_venta', 'cantidad', 'alerta', 'proveedor', 'descripcion', 'created_at', 'updated_at'].filter(c => columns.includes(c))
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO piezas (${columnsSql}) SELECT ${columnsSql} FROM piezas_old`)
        }
        db!.exec('DROP TABLE piezas_old')
        return
      }
      for (const column of ['costo', 'precio_venta', 'cantidad', 'alerta', 'proveedor', 'descripcion', 'created_at', 'updated_at']) {
        if (!columns.includes(column)) db!.exec(`ALTER TABLE piezas ADD COLUMN "${column}" TEXT DEFAULT ''`)
      }
      return
    }
    db!.exec(`CREATE TABLE piezas (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,costo REAL DEFAULT 0,precio_venta REAL DEFAULT 0,cantidad INTEGER DEFAULT 0,alerta INTEGER DEFAULT 1,proveedor TEXT DEFAULT '',descripcion TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  }

  try { db!.exec(`CREATE TABLE IF NOT EXISTS movimientos_piezas (id INTEGER PRIMARY KEY AUTOINCREMENT,pieza_id INTEGER NOT NULL,pieza_nombre TEXT DEFAULT '',tipo TEXT DEFAULT '',cantidad_antes INTEGER DEFAULT 0,cantidad_despues INTEGER DEFAULT 0,referencia TEXT DEFAULT '',fecha TEXT DEFAULT '',hora TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`) } catch {} 
  try { db!.exec(`CREATE TABLE IF NOT EXISTS reclamaciones (id INTEGER PRIMARY KEY AUTOINCREMENT,no_reclamacion TEXT DEFAULT '',fecha_emision TEXT DEFAULT '',fecha_respuesta TEXT DEFAULT '',fecha_vencimiento TEXT DEFAULT '',no_factura TEXT DEFAULT '',nombre_cliente TEXT DEFAULT '',telefono TEXT DEFAULT '',whatsapp TEXT DEFAULT '',email TEXT DEFAULT '',institucion TEXT DEFAULT '',articulo TEXT DEFAULT '',fecha_compra TEXT DEFAULT '',no_factura_rel TEXT DEFAULT '',estado TEXT DEFAULT 'ABIERTA',resultado TEXT DEFAULT '',respuesta TEXT DEFAULT '',fecha_cierre TEXT DEFAULT '',representante TEXT DEFAULT '',uid TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`) } catch {}

  function ensureTecnicosTable(): void {
    if (tableExists('tecnicos')) {
      const columns = tableColumns('tecnicos')
      if (!columns.includes('id')) {
        db!.exec(`ALTER TABLE tecnicos RENAME TO tecnicos_old`)
        db!.exec(`CREATE TABLE tecnicos (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,telefono TEXT DEFAULT '',email TEXT DEFAULT '',porcentaje REAL DEFAULT 0,estado TEXT DEFAULT 'ACTIVO',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        const copyColumns = ['nombre', 'telefono', 'email', 'porcentaje', 'estado', 'created_at', 'updated_at'].filter(c => columns.includes(c))
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO tecnicos (${columnsSql}) SELECT ${columnsSql} FROM tecnicos_old`)
        }
        db!.exec('DROP TABLE tecnicos_old')
        return
      }
      for (const column of ['telefono', 'email', 'porcentaje', 'estado', 'created_at', 'updated_at']) {
        if (!columns.includes(column)) db!.exec(`ALTER TABLE tecnicos ADD COLUMN "${column}" TEXT DEFAULT ''`)
      }
      return
    }
    db!.exec(`CREATE TABLE tecnicos (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,telefono TEXT DEFAULT '',email TEXT DEFAULT '',porcentaje REAL DEFAULT 0,estado TEXT DEFAULT 'ACTIVO',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  }

  function ensureCorreoTable(): void {
    db!.exec(`CREATE TABLE IF NOT EXISTS correo (id INTEGER PRIMARY KEY AUTOINCREMENT,host TEXT DEFAULT 'smtp.gmail.com',puerto TEXT DEFAULT '587',seguridad TEXT DEFAULT 'STARTTLS',email TEXT DEFAULT '',password TEXT DEFAULT '',nombre_remitente TEXT DEFAULT '',activo INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    const columns = tableColumns('correo')
    for (const column of ['nombre_remitente', 'activo', 'created_at', 'updated_at']) {
      if (!columns.includes(column)) {
        const type = column === 'activo' ? 'INTEGER DEFAULT 0' : "TEXT DEFAULT ''"
        db!.exec(`ALTER TABLE correo ADD COLUMN "${column}" ${type}`)
      }
    }
    db!.exec(`INSERT OR IGNORE INTO correo (id, host, puerto, seguridad, activo) VALUES (1, 'smtp.gmail.com', '587', 'STARTTLS', 0)`)
  }

  function ensureGastosTable(): void {
    if (tableExists('gastos')) {
      const columns = tableColumns('gastos')
      if (!columns.includes('id')) {
        db!.exec(`ALTER TABLE gastos RENAME TO gastos_old`)
        db!.exec(`CREATE TABLE gastos (id INTEGER PRIMARY KEY AUTOINCREMENT,cantidad REAL DEFAULT 0,fecha TEXT DEFAULT '',hora TEXT DEFAULT '',comentario TEXT DEFAULT '',turno_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        const copyColumns = ['cantidad', 'fecha', 'hora', 'comentario', 'turno_id', 'created_at', 'updated_at'].filter(c => columns.includes(c))
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO gastos (${columnsSql}) SELECT ${columnsSql} FROM gastos_old`)
        }
        db!.exec('DROP TABLE gastos_old')
        return
      }
      for (const column of ['cantidad', 'fecha', 'hora', 'comentario', 'created_at', 'updated_at']) {
        if (!columns.includes(column)) db!.exec(`ALTER TABLE gastos ADD COLUMN "${column}" TEXT DEFAULT ''`)
      }
      if (!columns.includes('turno_id')) db!.exec(`ALTER TABLE gastos ADD COLUMN turno_id INTEGER DEFAULT 0`)
      return
    }
    db!.exec(`CREATE TABLE gastos (id INTEGER PRIMARY KEY AUTOINCREMENT,cantidad REAL DEFAULT 0,fecha TEXT DEFAULT '',hora TEXT DEFAULT '',comentario TEXT DEFAULT '',turno_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  }

  function ensureFacturasTable(): void {
    const requiredColumns = ['cheque', 'token', 'cajero', 'no_factura', 'tipo_factura', 'comprobante', 'cod_cliente', 'nombre_cliente', 'telefono_cliente', 'productos', 'vendedor', 'metodo_pago', 'tarjeta', 'transferencia', 'efectivo', 'canal_venta', 'fecha_emision', 'impuesto', 'descuento', 'subtotal', 'total', 'ganancia', 'financiera', 'estado_factura', 'fecha_estado', 'mes', 'year', 'hora', 'otro', 'nota', 'usuario', 'identificadordb', 'total_institucion', 'total_cliente', 'ncf', 'tipo_comprobante', 'comprobante_id', 'turno_id', 'created_at', 'updated_at']
    if (tableExists('facturas')) {
      const columns = tableColumns('facturas')
      if (!columns.includes('id')) {
        db!.exec(`ALTER TABLE facturas RENAME TO facturas_old`)
        db!.exec(`CREATE TABLE facturas (id INTEGER PRIMARY KEY AUTOINCREMENT,cheque TEXT DEFAULT '',token TEXT DEFAULT '',cajero TEXT DEFAULT '',no_factura TEXT DEFAULT '',tipo_factura TEXT DEFAULT '',comprobante TEXT DEFAULT '',cod_cliente TEXT DEFAULT '',nombre_cliente TEXT DEFAULT '',telefono_cliente TEXT DEFAULT '',productos TEXT DEFAULT '',vendedor TEXT DEFAULT '',metodo_pago TEXT DEFAULT 'EFECTIVO',tarjeta REAL DEFAULT 0,transferencia REAL DEFAULT 0,efectivo REAL DEFAULT 0,canal_venta TEXT DEFAULT '',fecha_emision TEXT DEFAULT '',impuesto REAL DEFAULT 0,descuento REAL DEFAULT 0,subtotal REAL DEFAULT 0,total REAL DEFAULT 0,ganancia REAL DEFAULT 0,financiera TEXT DEFAULT '',estado_factura TEXT DEFAULT 'PENDIENTE',fecha_estado TEXT DEFAULT '',mes TEXT DEFAULT '',year TEXT DEFAULT '',hora TEXT DEFAULT '',otro TEXT DEFAULT '',nota TEXT DEFAULT '',usuario TEXT DEFAULT '',identificadordb TEXT DEFAULT '',total_institucion REAL DEFAULT 0,total_cliente REAL DEFAULT 0,ncf TEXT DEFAULT '',tipo_comprobante TEXT DEFAULT '',comprobante_id INTEGER DEFAULT 0,turno_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        const copyColumns = requiredColumns.filter(column => columns.includes(column))
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO facturas (${columnsSql}) SELECT ${columnsSql} FROM facturas_old`)
        }
        db!.exec('DROP TABLE facturas_old')
        return
      }
      if (!columns.includes('turno_id')) db!.exec(`ALTER TABLE facturas ADD COLUMN turno_id INTEGER DEFAULT 0`)
      for (const column of requiredColumns) {
        if (!columns.includes(column) && column !== 'turno_id') db!.exec(`ALTER TABLE facturas ADD COLUMN "${column}" TEXT DEFAULT ''`)
      }
      return
    }
    db!.exec(`CREATE TABLE facturas (id INTEGER PRIMARY KEY AUTOINCREMENT,cheque TEXT DEFAULT '',token TEXT DEFAULT '',cajero TEXT DEFAULT '',no_factura TEXT DEFAULT '',tipo_factura TEXT DEFAULT '',comprobante TEXT DEFAULT '',cod_cliente TEXT DEFAULT '',nombre_cliente TEXT DEFAULT '',telefono_cliente TEXT DEFAULT '',productos TEXT DEFAULT '',vendedor TEXT DEFAULT '',metodo_pago TEXT DEFAULT 'EFECTIVO',tarjeta REAL DEFAULT 0,transferencia REAL DEFAULT 0,efectivo REAL DEFAULT 0,canal_venta TEXT DEFAULT '',fecha_emision TEXT DEFAULT '',impuesto REAL DEFAULT 0,descuento REAL DEFAULT 0,subtotal REAL DEFAULT 0,total REAL DEFAULT 0,ganancia REAL DEFAULT 0,financiera TEXT DEFAULT '',estado_factura TEXT DEFAULT 'PENDIENTE',fecha_estado TEXT DEFAULT '',mes TEXT DEFAULT '',year TEXT DEFAULT '',hora TEXT DEFAULT '',otro TEXT DEFAULT '',nota TEXT DEFAULT '',usuario TEXT DEFAULT '',identificadordb TEXT DEFAULT '',total_institucion REAL DEFAULT 0,total_cliente REAL DEFAULT 0,ncf TEXT DEFAULT '',tipo_comprobante TEXT DEFAULT '',comprobante_id INTEGER DEFAULT 0,turno_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  }

  function ensureEmpresaTable(): void {
    const requiredColumns = ['nombre', 'legal', 'encargado', 'telefono', 'email', 'direccion', 'logo', 'impuesto', 'impuesto_incluido', 'moneda', 'tipo_documento_defecto', 'almacen_id', 'created_at', 'updated_at']
    if (tableExists('empresa')) {
      const columns = tableColumns('empresa')
      if (!columns.includes('id')) {
        db!.exec(`ALTER TABLE empresa RENAME TO empresa_old`)
        db!.exec(`CREATE TABLE empresa (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT DEFAULT '',legal TEXT DEFAULT '',encargado TEXT DEFAULT '',telefono TEXT DEFAULT '',email TEXT DEFAULT '',direccion TEXT DEFAULT '',logo TEXT DEFAULT '',impuesto REAL DEFAULT 18,impuesto_incluido INTEGER DEFAULT 0,moneda TEXT DEFAULT 'RD$',tipo_documento_defecto TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
        const copyColumns = requiredColumns.filter(column => columns.includes(column))
        if (copyColumns.length > 0) {
          const columnsSql = copyColumns.map(column => `"${column}"`).join(', ')
          db!.exec(`INSERT INTO empresa (${columnsSql}) SELECT ${columnsSql} FROM empresa_old`)
        }
        db!.exec('DROP TABLE empresa_old')
        return
      }
      for (const column of requiredColumns) {
        if (!columns.includes(column)) {
          const isNumeric = ['impuesto', 'impuesto_incluido', 'almacen_id'].includes(column)
          db!.exec(`ALTER TABLE empresa ADD COLUMN "${column}" ${isNumeric ? (column === 'impuesto_incluido' || column === 'almacen_id' ? 'INTEGER' : 'REAL') : 'TEXT'} DEFAULT ${isNumeric ? (column === 'impuesto_incluido' ? '1' : column === 'almacen_id' ? '0' : '18') : "''"}`)
        }
      }
      return
    }
    db!.exec(`CREATE TABLE empresa (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT DEFAULT '',legal TEXT DEFAULT '',encargado TEXT DEFAULT '',telefono TEXT DEFAULT '',email TEXT DEFAULT '',direccion TEXT DEFAULT '',logo TEXT DEFAULT '',impuesto REAL DEFAULT 18,impuesto_incluido INTEGER DEFAULT 0,moneda TEXT DEFAULT 'RD$',tipo_documento_defecto TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    db!.exec(`INSERT INTO empresa (nombre) VALUES ('MI EMPRESA')`)
  }

  db.exec(`CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,descripcion TEXT DEFAULT '',estado TEXT DEFAULT 'activo',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS marcas (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,descripcion TEXT DEFAULT '',estado TEXT DEFAULT 'activo',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS accesorios (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,codigo_barra TEXT DEFAULT '',costo REAL DEFAULT 0,precio_venta REAL DEFAULT 0,precio_min REAL DEFAULT 0,precio_xmayor REAL DEFAULT 0,cantidad INTEGER DEFAULT 1,alerta INTEGER DEFAULT 10,marca INTEGER,categoria INTEGER,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (marca) REFERENCES marcas(id),FOREIGN KEY (categoria) REFERENCES categorias(id))`)
  try { db!.exec(`ALTER TABLE accesorios ADD COLUMN codigo_barra TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE accesorios ADD COLUMN proveedor_id INTEGER DEFAULT 0`) } catch {}
  try { db!.exec(`ALTER TABLE accesorios ADD COLUMN imagen TEXT DEFAULT ''`) } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS telefonos (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  try { db!.exec(`ALTER TABLE telefonos ADD COLUMN imagen TEXT DEFAULT ''`) } catch {}
  ensureProveedoresTable()
  ensureClientesTable()
  ensureUsuariosTable()
  ensurePiezasTable()
  ensureTecnicosTable()
  ensureCorreoTable()
  ensureGastosTable()
  ensureFacturasTable()
  ensureEmpresaTable()

  db.exec(`CREATE TABLE IF NOT EXISTS impresoras_config (id INTEGER PRIMARY KEY AUTOINCREMENT,printer_name TEXT DEFAULT '',printer_model TEXT DEFAULT '',paper_width INTEGER DEFAULT 80,show_logo INTEGER DEFAULT 1,show_company_name INTEGER DEFAULT 1,show_legal INTEGER DEFAULT 1,show_phone INTEGER DEFAULT 1,show_address INTEGER DEFAULT 1,show_email INTEGER DEFAULT 1,show_cliente INTEGER DEFAULT 1,show_items INTEGER DEFAULT 1,show_totals INTEGER DEFAULT 1,show_barcode INTEGER DEFAULT 1,show_footer INTEGER DEFAULT 1,show_qr INTEGER DEFAULT 0,footer_text TEXT DEFAULT 'Gracias por su compra',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS cuentas_cobrar (id INTEGER PRIMARY KEY AUTOINCREMENT,no_factura TEXT DEFAULT '',cod_cliente TEXT DEFAULT '',nombre_cliente TEXT DEFAULT '',telefono_cliente TEXT DEFAULT '',total REAL DEFAULT 0,abonado REAL DEFAULT 0,saldo REAL DEFAULT 0,fecha_venta TEXT DEFAULT '',fecha_vencimiento TEXT DEFAULT '',estado TEXT DEFAULT 'ACTIVA',notas TEXT DEFAULT '',uid TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`INSERT OR IGNORE INTO impresoras_config (id) VALUES (1)`)
  try { db!.exec(`ALTER TABLE impresoras_config ADD COLUMN show_cliente INTEGER DEFAULT 1`) } catch {}
  try { db!.exec(`ALTER TABLE impresoras_config ADD COLUMN show_nota INTEGER DEFAULT 1`) } catch {}
  try { db!.exec(`ALTER TABLE impresoras_config ADD COLUMN copies INTEGER DEFAULT 1`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN pagos TEXT DEFAULT '[]'`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN uid TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN telefono_cliente TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN fecha_vencimiento TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN total REAL DEFAULT 0`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN abonado REAL DEFAULT 0`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN saldo REAL DEFAULT 0`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN notas TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN cod_cliente TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN nombre_cliente TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN no_factura TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN fecha_venta TEXT DEFAULT ''`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN estado TEXT DEFAULT 'ACTIVA'`) } catch {}
  try { db!.exec(`ALTER TABLE cuentas_cobrar ADD COLUMN almacen_id INTEGER DEFAULT 0`) } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS cuentas_pagar (id INTEGER PRIMARY KEY AUTOINCREMENT,no_factura TEXT DEFAULT '',cod_proveedor TEXT DEFAULT '',nombre_proveedor TEXT DEFAULT '',telefono_proveedor TEXT DEFAULT '',total REAL DEFAULT 0,abonado REAL DEFAULT 0,saldo REAL DEFAULT 0,fecha_compra TEXT DEFAULT '',fecha_vencimiento TEXT DEFAULT '',estado TEXT DEFAULT 'ACTIVA',notas TEXT DEFAULT '',pagos TEXT DEFAULT '[]',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS bitacora (id INTEGER PRIMARY KEY AUTOINCREMENT,tabla TEXT DEFAULT '',registro_id INTEGER DEFAULT 0,accion TEXT DEFAULT '',usuario TEXT DEFAULT '',datos_nuevos TEXT DEFAULT '',datos_anteriores TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS configuracion (id INTEGER PRIMARY KEY AUTOINCREMENT,clave TEXT UNIQUE NOT NULL,valor TEXT DEFAULT '',tipo TEXT DEFAULT 'string',categoria TEXT DEFAULT 'general',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS plantillas_etiquetas (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,ancho REAL DEFAULT 50,alto REAL DEFAULT 30,elementos TEXT DEFAULT '[]',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS licencia (id INTEGER PRIMARY KEY AUTOINCREMENT,licencia_equipo TEXT,licencia_cifrada TEXT,estado TEXT DEFAULT 'sin_verificar',nombre_empresa TEXT,fecha_inicio_prueba TEXT,fecha_vencimiento TEXT,ultima_verificacion TEXT,api_key TEXT,datos_servidor TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`INSERT OR IGNORE INTO licencia (id, estado) VALUES (1, 'sin_verificar')`)
  try { db.exec(`ALTER TABLE licencia ADD COLUMN datos_servidor TEXT`) } catch {}
  const badKey = db!.prepare(`SELECT api_key FROM licencia WHERE id = 1`).get() as any
  if (badKey?.api_key && /^\d+-[0-9A-F]{12}$/i.test(badKey.api_key)) {
    db!.prepare(`UPDATE licencia SET api_key = NULL, updated_at = datetime('now','localtime') WHERE id = 1`).run()
  }
  db.exec(`CREATE TABLE IF NOT EXISTS imei (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,id_equi INTEGER,costo REAL DEFAULT 0,precio_venta REAL DEFAULT 0,precio_min REAL DEFAULT 0,precio_xmayor REAL DEFAULT 0,color TEXT DEFAULT '',capacidad TEXT DEFAULT '',bateria TEXT DEFAULT '',estado TEXT DEFAULT 'DISPONIBLE',fecha_venta TEXT,comprador TEXT DEFAULT '',proveedor TEXT DEFAULT '',no_compra TEXT DEFAULT '',precio_vendido REAL DEFAULT 0,hora_venta TEXT DEFAULT '',no_factura TEXT DEFAULT '',nota TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (id_equi) REFERENCES telefonos(id))`)
  db.exec(`CREATE TABLE IF NOT EXISTS electrodomesticos (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  try { db!.exec(`ALTER TABLE electrodomesticos ADD COLUMN imagen TEXT DEFAULT ''`) } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS serial (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,id_equi INTEGER,costo REAL DEFAULT 0,precio_venta REAL DEFAULT 0,precio_min REAL DEFAULT 0,precio_xmayor REAL DEFAULT 0,color TEXT DEFAULT '',capacidad TEXT DEFAULT '',bateria TEXT DEFAULT '',estado TEXT DEFAULT 'DISPONIBLE',fecha_venta TEXT,comprador TEXT DEFAULT '',proveedor TEXT DEFAULT '',no_compra TEXT DEFAULT '',precio_vendido REAL DEFAULT 0,hora_venta TEXT DEFAULT '',no_factura TEXT DEFAULT '',nota TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (id_equi) REFERENCES electrodomesticos(id))`)
  db.exec(`CREATE TABLE IF NOT EXISTS notas (id INTEGER PRIMARY KEY AUTOINCREMENT,titulo TEXT NOT NULL,contenido TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  try {
    const cols = db.prepare("PRAGMA table_info(notas)").all() as any[]
    if (cols.some((c: any) => c.name === 'nombre')) {
      db.exec("ALTER TABLE notas RENAME TO notas_old")
      db.exec(`CREATE TABLE IF NOT EXISTS notas (id INTEGER PRIMARY KEY AUTOINCREMENT,titulo TEXT NOT NULL,contenido TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
      db.exec("INSERT INTO notas (titulo, contenido) SELECT nombre, '' FROM notas_old")
      db.exec("DROP TABLE notas_old")
    }
  } catch {}
  const countNotas = db.prepare('SELECT COUNT(*) as total FROM notas').get() as any
  if (countNotas.total === 0) {
    const insert = db.prepare('INSERT INTO notas (titulo, contenido) VALUES (?, ?)')
    for (const [titulo, contenido] of [
      ['SIN SELLO', 'Sin sello de fabrica'], ['CAMBIO', 'Cambio del producto'], ['GARANTIA', 'Garantia del producto'],
      ['ENTREGADO', 'Producto entregado al cliente'], ['REPARACION', 'Reparacion del equipo'],
      ['A DOMICILIO', 'Envio a domicilio'], ['CON FACTURA', 'Venta con factura fiscal'],
      ['SIN FACTURA', 'Venta sin factura fiscal'], ['PENDIENTE', 'Pendiente por entregar'],
      ['OBSERVACION', 'Observacion general'],
    ]) insert.run(titulo, contenido)
  }
  db.exec(`CREATE TABLE IF NOT EXISTS ordenes_taller (id INTEGER PRIMARY KEY AUTOINCREMENT,no_orden TEXT DEFAULT '',nombre TEXT NOT NULL,cedula TEXT DEFAULT '',telefono TEXT DEFAULT '',email TEXT DEFAULT '',equipo TEXT DEFAULT '',imei TEXT DEFAULT '',serial TEXT DEFAULT '',marca_modelo TEXT DEFAULT '',clave TEXT DEFAULT '',accesorios TEXT DEFAULT '',fallas TEXT DEFAULT '',piezas TEXT DEFAULT '',tecnico TEXT DEFAULT '',metodo_pago TEXT DEFAULT 'EFECTIVO',fecha_entrada TEXT,fecha_entrega TEXT,estado TEXT DEFAULT 'RECIBIDO',precio_pieza REAL DEFAULT 0,mano_obra REAL DEFAULT 0,abono REAL DEFAULT 0,pendiente REAL DEFAULT 0,total REAL DEFAULT 0,pagos TEXT DEFAULT '',beneficio_empresa REAL DEFAULT 0,beneficio_tecnico REAL DEFAULT 0,porcentaje_tecnico REAL DEFAULT 0,estado_pago_tecnico TEXT DEFAULT 'PENDIENTE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  try { db!.exec(`ALTER TABLE ordenes_taller ADD COLUMN imagen TEXT DEFAULT ''`) } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS comprobantes_fiscales (id INTEGER PRIMARY KEY AUTOINCREMENT,tipo TEXT NOT NULL,nombre TEXT NOT NULL,descripcion TEXT DEFAULT '',prefijo TEXT DEFAULT '',secuencia_actual INTEGER DEFAULT 1,secuencia_desde INTEGER DEFAULT 1,secuencia_hasta INTEGER DEFAULT 99999999,fecha_vencimiento TEXT DEFAULT '',activo INTEGER DEFAULT 1,es_default INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  try { db!.exec(`ALTER TABLE comprobantes_fiscales ADD COLUMN prefijo TEXT DEFAULT ''`) } catch {}
  const count = db!.prepare(`SELECT COUNT(*) as c FROM comprobantes_fiscales`).get() as any
  if (count.c === 0) {
    const insert = db!.prepare(`INSERT INTO comprobantes_fiscales (tipo, nombre, descripcion, prefijo, secuencia_actual, secuencia_desde, secuencia_hasta, activo, es_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    insert.run('SIN', 'Sin Comprobante', 'Venta sin comprobante fiscal', '', 1, 1, 99999999, 1, 0)
    insert.run('E31', 'Factura de Credito Fiscal', 'Ventas a contribuyentes con RNC', 'E31', 1, 1, 99999999, 1, 0)
    insert.run('E32', 'Factura de Consumo', 'Ventas a consumidores finales', 'E32', 1, 1, 99999999, 1, 1)
    insert.run('E33', 'Nota de Debito', 'Cargos adicionales', 'E33', 1, 1, 99999999, 1, 0)
    insert.run('E34', 'Nota de Credito', 'Devoluciones y descuentos', 'E34', 1, 1, 99999999, 1, 0)
    insert.run('E41', 'Compras', 'Comprobante de compras', 'E41', 1, 1, 99999999, 1, 0)
    insert.run('E43', 'Gastos Menores', 'Gastos menores sin comprobante', 'E43', 1, 1, 99999999, 1, 0)
    insert.run('E44', 'Regimenes Especiales', 'Ventas a zonas francas', 'E44', 1, 1, 99999999, 1, 0)
    insert.run('E45', 'Gubernamental', 'Ventas al gobierno', 'E45', 1, 1, 99999999, 1, 0)
    insert.run('E46', 'Exportacion', 'Ventas al exterior', 'E46', 1, 1, 99999999, 1, 0)
    insert.run('E47', 'Pagos al Exterior', 'Pagos a proveedores extranjeros', 'E47', 1, 1, 99999999, 1, 0)
  }
  db.exec(`CREATE TABLE IF NOT EXISTS gastos_fijos (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,monto REAL DEFAULT 0,dia_pago INTEGER DEFAULT 1,categoria TEXT DEFAULT '',periodicidad TEXT DEFAULT 'MENSUAL',estado TEXT DEFAULT 'ACTIVO',descripcion TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS sync_deletes (id INTEGER PRIMARY KEY AUTOINCREMENT,tabla TEXT NOT NULL,uid TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS tmcloud_config (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL DEFAULT '',public_key TEXT NOT NULL DEFAULT '',secret_key TEXT NOT NULL DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.prepare(`INSERT OR IGNORE INTO tmcloud_config (id, url, public_key, secret_key) VALUES (1, '', '', '')`).run()
  db.exec(`CREATE TABLE IF NOT EXISTS caja_turnos (id INTEGER PRIMARY KEY AUTOINCREMENT,monto_inicial REAL DEFAULT 0,entradas REAL DEFAULT 0,retiros REAL DEFAULT 0,estado TEXT DEFAULT 'abierto',observacion TEXT DEFAULT '',usuario_id INTEGER DEFAULT 0,usuario_nombre TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS caja_movimientos (id INTEGER PRIMARY KEY AUTOINCREMENT,turno_id INTEGER,tipo TEXT,monto REAL DEFAULT 0,descripcion TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS almacenes (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL DEFAULT '',codigo TEXT DEFAULT '',direccion TEXT DEFAULT '',telefono TEXT DEFAULT '',email TEXT DEFAULT '',rnc TEXT DEFAULT '',logo TEXT DEFAULT '',estado TEXT DEFAULT 'ACTIVO',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.prepare(`INSERT OR IGNORE INTO almacenes (id, nombre, codigo) VALUES (1, 'Almacen Principal', 'PRINCIPAL')`).run()
  db.exec(`CREATE TABLE IF NOT EXISTS metodos_pago (id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL DEFAULT '',porcentaje REAL DEFAULT 0,estado TEXT DEFAULT 'ACTIVO',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.prepare(`INSERT OR IGNORE INTO metodos_pago (id, nombre, porcentaje) VALUES (1, 'EFECTIVO', 0)`).run()
  db.prepare(`INSERT OR IGNORE INTO metodos_pago (id, nombre, porcentaje) VALUES (2, 'TARJETA', 2.5)`).run()
  db.prepare(`INSERT OR IGNORE INTO metodos_pago (id, nombre, porcentaje) VALUES (3, 'TRANSFERENCIA', 0)`).run()
  db.exec(`CREATE TABLE IF NOT EXISTS ordenes_compra (id INTEGER PRIMARY KEY AUTOINCREMENT,no_orden TEXT DEFAULT '',proveedor_id INTEGER DEFAULT 0,proveedor_nombre TEXT DEFAULT '',fecha_orden TEXT DEFAULT '',fecha_recibido TEXT DEFAULT '',estado TEXT DEFAULT 'PENDIENTE',productos TEXT DEFAULT '',subtotal REAL DEFAULT 0,impuesto REAL DEFAULT 0,descuento REAL DEFAULT 0,total REAL DEFAULT 0,nota TEXT DEFAULT '',usuario TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS transferencias (id INTEGER PRIMARY KEY AUTOINCREMENT,no_transferencia TEXT DEFAULT '',origen_id INTEGER DEFAULT 0,origen_nombre TEXT DEFAULT '',destino_id INTEGER DEFAULT 0,destino_nombre TEXT DEFAULT '',productos TEXT DEFAULT '',estado TEXT DEFAULT 'PENDIENTE',usuario TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS ajustes_inventario (id INTEGER PRIMARY KEY AUTOINCREMENT,tabla TEXT DEFAULT '',producto_id INTEGER DEFAULT 0,producto_nombre TEXT DEFAULT '',cantidad_anterior REAL DEFAULT 0,cantidad_nueva REAL DEFAULT 0,diferencia REAL DEFAULT 0,tipo TEXT DEFAULT '',motivo TEXT DEFAULT '',usuario TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS garantias (id INTEGER PRIMARY KEY AUTOINCREMENT,no_factura TEXT DEFAULT '',tipo_producto TEXT DEFAULT '',producto_id INTEGER DEFAULT 0,producto_nombre TEXT DEFAULT '',imei TEXT DEFAULT '',serial TEXT DEFAULT '',cliente_nombre TEXT DEFAULT '',cliente_telefono TEXT DEFAULT '',fecha_venta TEXT DEFAULT '',fecha_vencimiento TEXT DEFAULT '',dias_garantia INTEGER DEFAULT 30,estado TEXT DEFAULT 'ACTIVA',nota TEXT DEFAULT '',usuario TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS reclamos_garantia (id INTEGER PRIMARY KEY AUTOINCREMENT,garantia_id INTEGER DEFAULT 0,descripcion TEXT DEFAULT '',solucion TEXT DEFAULT '',estado TEXT DEFAULT 'PENDIENTE',fecha_ingreso TEXT DEFAULT '',fecha_salida TEXT DEFAULT '',costo REAL DEFAULT 0,tecnico TEXT DEFAULT '',usuario TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS comisiones (id INTEGER PRIMARY KEY AUTOINCREMENT,factura_id INTEGER DEFAULT 0,no_factura TEXT DEFAULT '',productos TEXT DEFAULT '',vendedor TEXT DEFAULT '',vendedor_id INTEGER DEFAULT 0,total_venta REAL DEFAULT 0,porcentaje REAL DEFAULT 0,monto REAL DEFAULT 0,estado TEXT DEFAULT 'PENDIENTE',fecha_pago TEXT DEFAULT '',usuario TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS historial_precios (id INTEGER PRIMARY KEY AUTOINCREMENT,tabla TEXT DEFAULT '',producto_id INTEGER DEFAULT 0,producto_nombre TEXT DEFAULT '',campo TEXT DEFAULT '',valor_anterior TEXT DEFAULT '',valor_nuevo TEXT DEFAULT '',usuario TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS tickets_soporte (id INTEGER PRIMARY KEY AUTOINCREMENT,codigo TEXT DEFAULT '',cliente_nombre TEXT DEFAULT '',cliente_telefono TEXT DEFAULT '',cliente_email TEXT DEFAULT '',producto TEXT DEFAULT '',descripcion TEXT DEFAULT '',prioridad TEXT DEFAULT 'NORMAL',estado TEXT DEFAULT 'ABIERTO',asignado TEXT DEFAULT '',solucion TEXT DEFAULT '',fecha_cierre TEXT DEFAULT '',usuario TEXT DEFAULT '',almacen_id INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS ticket_comentarios (id INTEGER PRIMARY KEY AUTOINCREMENT,ticket_id INTEGER DEFAULT 0,comentario TEXT DEFAULT '',tipo TEXT DEFAULT 'COMENTARIO',usuario TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE IF NOT EXISTS cuadres (id INTEGER PRIMARY KEY AUTOINCREMENT,fecha TEXT DEFAULT '',turno_id INTEGER DEFAULT 0,turno_usuario TEXT DEFAULT '',monto_inicial REAL DEFAULT 0,total_ventas REAL DEFAULT 0,efectivo REAL DEFAULT 0,tarjeta REAL DEFAULT 0,transferencia REAL DEFAULT 0,total_gastos REAL DEFAULT 0,saldo_final REAL DEFAULT 0,observacion TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  const tablasConAlmacen = ['facturas', 'clientes', 'proveedores', 'telefonos', 'accesorios', 'electrodomesticos', 'imei', 'serial', 'piezas', 'tecnicos', 'ordenes_taller', 'gastos', 'gastos_fijos', 'cuentas_cobrar', 'cuentas_pagar', 'notas', 'comprobantes_fiscales', 'plantillas_etiquetas', 'correo']
  for (const t of tablasConAlmacen) { try { db!.exec(`ALTER TABLE "${t}" ADD COLUMN almacen_id INTEGER DEFAULT 0`) } catch {} }
}

function registrarBitacora(tabla: string, registroId: number, accion: string, usuario: string, datosNuevos: any, datosAnteriores: any) {
  try {
    const now = new Date().toISOString()
    db!.prepare(`INSERT INTO bitacora (tabla, registro_id, accion, usuario, datos_nuevos, datos_anteriores, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      tabla, registroId, accion, usuario || '', JSON.stringify(datosNuevos || {}), JSON.stringify(datosAnteriores || {}), now
    )
  } catch {}
}

function setupIpcHandlers(): void {
  ipcMain.handle('db:getAll', (_event, tabla: string) => {
    try {
      const rows = db!.prepare(`SELECT * FROM "${tabla}" ORDER BY id DESC`).all()
      return { success: true, data: rows }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getWhere', (_event, tabla: string, where: string, params: any[] = []) => {
    try {
      const clause = where ? `WHERE ${where}` : ''
      const rows = db!.prepare(`SELECT * FROM "${tabla}" ${clause} ORDER BY id DESC`).all(...params)
      return { success: true, data: rows }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getModified', (_event, tabla: string, desde: string) => {
    try {
      if (!desde) {
        const rows = db!.prepare(`SELECT * FROM "${tabla}" ORDER BY id DESC`).all()
        return { success: true, data: rows }
      }
      const rows = db!.prepare(`SELECT * FROM "${tabla}" WHERE updated_at > ? ORDER BY updated_at ASC`).all(desde)
      return { success: true, data: rows }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getById', (_event, tabla: string, id: number) => {
    try {
      const row = db!.prepare(`SELECT * FROM "${tabla}" WHERE id = ?`).get(id)
      return { success: true, data: row }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:insert', (_event, tabla: string, data: Record<string, any>, usuario?: string) => {
    try {
      if (!data.uid) data.uid = generarUid()
      data.created_at = new Date().toISOString()
      data.updated_at = new Date().toISOString()
      const keys = Object.keys(data)
      const placeholders = keys.map(() => '?').join(', ')
      const values = Object.values(data)
      const stmt = db!.prepare(`INSERT INTO "${tabla}" (${keys.join(', ')}) VALUES (${placeholders})`)
      const result = stmt.run(...values)
      const newId = Number(result.lastInsertRowid)
      if (tabla !== 'bitacora') registrarBitacora(tabla, Number(newId), 'CREATE', usuario || '', data, null)
      return { success: true, data: { id: newId } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:update', (_event, tabla: string, id: number, data: Record<string, any>, usuario?: string) => {
    try {
      const oldData = db!.prepare(`SELECT * FROM "${tabla}" WHERE id = ?`).get(id) as Record<string, any> || {}
      data.updated_at = new Date().toISOString()
      const keys = Object.keys(data)
      const sets = keys.map(k => `${k} = ?`).join(', ')
      const values = [...Object.values(data), id]
      const stmt = db!.prepare(`UPDATE "${tabla}" SET ${sets} WHERE id = ?`)
      stmt.run(...values)
      if (tabla !== 'bitacora') registrarBitacora(tabla, id, 'UPDATE', usuario || '', data, oldData)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:delete', (_event, tabla: string, id: number, usuario?: string) => {
    try {
      const oldData = db!.prepare(`SELECT * FROM "${tabla}" WHERE id = ?`).get(id) as Record<string, any> || {}
      const uid = oldData?.uid || ''
      db!.prepare(`DELETE FROM "${tabla}" WHERE id = ?`).run(id)
      if (tabla !== 'bitacora' && tabla !== 'sync_deletes') {
        registrarBitacora(tabla, id, 'DELETE', usuario || '', null, oldData)
        if (uid) {
          try { db!.prepare(`INSERT INTO sync_deletes (tabla, uid) VALUES (?, ?)`).run(tabla, uid) } catch {}
        }
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('config:get', (_event, clave: string) => {
    try {
      const row = db!.prepare(`SELECT valor FROM configuracion WHERE clave = ?`).get(clave) as any
      return { success: true, data: row ? row.valor : '' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('config:set', (_event, clave: string, valor: string, categoria = 'general') => {
    try {
      guardarConfigLocal(clave, valor, categoria)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:bitacoraList', (_event, limite = 1000) => {
    try {
      const rows = db!.prepare(`SELECT * FROM bitacora ORDER BY id DESC LIMIT ?`).all(limite)
      return { success: true, data: rows }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:bitacoraDeleteAll', () => {
    try {
      db!.exec('DELETE FROM bitacora')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:exec', (_event, sql: string) => {
    try {
      db!.exec(sql)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ===== LICENCIA =====
  function obtenerMacAddress(): string | null {
    try {
      return getMachineId()
    } catch {}
    try {
      const row = db!.prepare(`SELECT licencia_equipo FROM licencia WHERE id = 1`).get() as any
      if (row?.licencia_equipo && row.licencia_equipo.length > 0) return row.licencia_equipo
    } catch {}
    try {
      const id = getMachineIdLegacy()
      db!.prepare(`UPDATE licencia SET licencia_equipo = COALESCE(NULLIF(licencia_equipo, ''), ?), licencia_cifrada = COALESCE(NULLIF(licencia_cifrada, ''), ?), updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(id, cifrarBase64(id))
      return id
    } catch {}
    return null
  }

  function cifrarBase64(valor: string) {
    return Buffer.from(String(valor || '').trim().toUpperCase()).toString('base64')
  }

  function calcularDiasRestantes(fechaVencimiento?: string): number | null {
    if (!fechaVencimiento) return null
    return Math.ceil((new Date(fechaVencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  function getLicenciaApiUrl(): string {
    const row = db!.prepare(`SELECT url FROM tmcloud_config WHERE id = 1`).get() as any
    return row?.url ? row.url.replace(/\/+$/, '') : ''
  }

  function getLicenciaReadToken(): string {
    const row = db!.prepare(`SELECT public_key, secret_key FROM tmcloud_config WHERE id = 1`).get() as any
    if (row?.public_key) return row.public_key
    if (row?.secret_key) return row.secret_key
    return getLegacyLicenciaToken()
  }

  function getLicenciaWriteToken(): string {
    const row = db!.prepare(`SELECT secret_key, public_key FROM tmcloud_config WHERE id = 1`).get() as any
    if (row?.secret_key) return row.secret_key
    if (row?.public_key) return row.public_key
    return getLegacyLicenciaToken()
  }

  function getLegacyLicenciaToken(): string {
    const row = db!.prepare(`SELECT api_key FROM licencia WHERE id = 1`).get() as any
    return row?.api_key || bcrypt.hashSync('1234567890abc', 10)
  }

  const DIAS_PRUEBA = 7
  const DIAS_GRACIA_OFFLINE = 5
  const licenciaEquipoOtp = new Map<string, { codigo: string; licencia: string; email: string; mac: string; expiresAt: number; datosServidor: any }>()
  const licenciaVisualizacionOtp = new Map<string, { codigo: string; licencia: string; email: string; expiresAt: number }>()
  const facturaEliminacionOtp = new Map<string, { codigo: string; facturaIds: number[]; email: string; expiresAt: number }>()

  function getLicenciaAuthToken(): string {
    return getLicenciaWriteToken()
  }

  function getLicenciaLocal() {
    const row = db!.prepare(`SELECT * FROM licencia WHERE id = 1`).get() as any
    if (!row) return null
    let datosServidor = null
    try { datosServidor = row.datos_servidor ? JSON.parse(row.datos_servidor) : null } catch {}
    return { ...row, datosServidor }
  }

  function guardarConfigLocal(clave: string, valor: string, categoria = 'supabase') {
    const value = String(valor || '').trim()
    const row = db!.prepare(`SELECT id FROM configuracion WHERE clave = ?`).get(clave) as any
    if (!value) {
      if (row) db!.prepare(`DELETE FROM configuracion WHERE id = ?`).run(row.id)
      return
    }
    if (row) {
      db!.prepare(`UPDATE configuracion SET valor = ?, categoria = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(value, categoria, row.id)
    } else {
      db!.prepare(`INSERT INTO configuracion (clave, valor, tipo, categoria, created_at, updated_at) VALUES (?, ?, 'string', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(clave, value, categoria)
    }
  }

  function guardarCredencialesTmCloud(datosServidor: any) {
    if (!datosServidor || typeof datosServidor !== 'object') return
    const url = datosServidor.project_url || datosServidor.url_supabase || datosServidor.supabase_url || datosServidor.urlSupabase || ''
    const publicKey = datosServidor.public_key || datosServidor.supabase_anon_key || datosServidor.anon_key || ''
    const secretKey = datosServidor.secret_key || datosServidor.role_key || datosServidor.supabase_service_role || datosServidor.service_role || ''
    if (url || publicKey || secretKey) {
      const row = db!.prepare(`SELECT id FROM tmcloud_config WHERE id = 1`).get() as any
      if (row) {
        db!.prepare(`UPDATE tmcloud_config SET url = COALESCE(NULLIF(?, ''), url), public_key = COALESCE(NULLIF(?, ''), public_key), secret_key = COALESCE(NULLIF(?, ''), secret_key), updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(url, publicKey, secretKey)
      } else {
        db!.prepare(`INSERT INTO tmcloud_config (id, url, public_key, secret_key) VALUES (1, ?, ?, ?)`).run(url, publicKey, secretKey)
      }
    }
  }

  function guardarSupabaseDesdeLicencia(datosServidor: any) {
    if (!datosServidor || typeof datosServidor !== 'object') return

    const url = datosServidor.url_supabase || datosServidor.supabase_url || datosServidor.urlSupabase || ''
    const publicKey = datosServidor.public_key || datosServidor.supabase_anon_key || datosServidor.anon_key || datosServidor.publicKey || ''
    const roleKey = datosServidor.role_key || datosServidor.supabase_service_role || datosServidor.service_role || datosServidor.roleKey || ''

    if (url || publicKey || roleKey) {
      const row = db!.prepare(`SELECT id FROM tmcloud_config WHERE id = 1`).get() as any
      if (row) {
        db!.prepare(`UPDATE tmcloud_config SET url = COALESCE(NULLIF(?, ''), url), public_key = COALESCE(NULLIF(?, ''), public_key), secret_key = COALESCE(NULLIF(?, ''), secret_key), updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(url, publicKey, roleKey)
      } else {
        db!.prepare(`INSERT INTO tmcloud_config (id, url, public_key, secret_key) VALUES (1, ?, ?, ?)`).run(url, publicKey, roleKey)
      }
    }
    db!.prepare(`DELETE FROM configuracion WHERE clave IN ('supabase_url', 'supabase_anon_key', 'supabase_service_role', 'tmcloud_url', 'tmcloud_key', 'tmcloud_service_key')`).run()
  }

  function guardarEmpresaDesdeLicencia(datosServidor: any) {
    if (!datosServidor || typeof datosServidor !== 'object') return

    const empresaServidor = datosServidor.empresa && typeof datosServidor.empresa === 'object'
      ? datosServidor.empresa
      : {}
    const valor = (...campos: string[]) => {
      for (const campo of campos) {
        const encontrado = empresaServidor[campo] ?? datosServidor[campo]
        if (encontrado !== undefined && encontrado !== null && String(encontrado).trim()) {
          return String(encontrado).trim()
        }
      }
      return ''
    }

    const nombre = valor('nombre', 'nombre_empresa', 'empresa_nombre', 'almacen', 'comercio')
    const legal = valor('legal', 'razon_social', 'rnc', 'rnc_cedula', 'cedula', 'documento', 'identificacion')
    const encargado = valor('encargado', 'representante', 'contacto', 'administrador')
    const telefono = valor('telefono', 'telefono_empresa', 'celular', 'whatsapp')
    const email = valor('email', 'correo', 'correo_empresa', 'email_empresa').toLowerCase()
    const direccion = valor('direccion', 'direccion_empresa', 'domicilio')

    if (!nombre && !legal && !encargado && !telefono && !email && !direccion) return

    const empresaLocal = db!.prepare(`SELECT id FROM empresa ORDER BY id DESC LIMIT 1`).get() as any
    if (empresaLocal?.id) {
      db!.prepare(`
        UPDATE empresa
        SET nombre = COALESCE(NULLIF(?, ''), nombre),
            legal = COALESCE(NULLIF(?, ''), legal),
            encargado = COALESCE(NULLIF(?, ''), encargado),
            telefono = COALESCE(NULLIF(?, ''), telefono),
            email = COALESCE(NULLIF(?, ''), email),
            direccion = COALESCE(NULLIF(?, ''), direccion),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nombre, legal, encargado, telefono, email, direccion, empresaLocal.id)
    } else {
      db!.prepare(`
        INSERT INTO empresa (nombre, legal, encargado, telefono, email, direccion, uid, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(nombre || 'MI EMPRESA', legal, encargado, telefono, email, direccion, generarUid())
    }
  }

  function guardarLicenciaLocal(datos: any) {
    const mac = obtenerMacAddress()
    const cifrada = mac ? cifrarBase64(mac) : ''
    const datosJson = datos.datosServidor ? JSON.stringify(datos.datosServidor) : null
    db!.prepare(`INSERT INTO licencia (id, licencia_equipo, licencia_cifrada, estado, nombre_empresa, fecha_inicio_prueba, fecha_vencimiento, ultima_verificacion, datos_servidor, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET licencia_equipo = COALESCE(excluded.licencia_equipo, licencia_equipo), licencia_cifrada = COALESCE(excluded.licencia_cifrada, licencia_cifrada), estado = excluded.estado, nombre_empresa = excluded.nombre_empresa, fecha_inicio_prueba = excluded.fecha_inicio_prueba, fecha_vencimiento = excluded.fecha_vencimiento, ultima_verificacion = excluded.ultima_verificacion, datos_servidor = excluded.datos_servidor, updated_at = excluded.updated_at`).run(
      mac || null, cifrada || null, datos.estado || 'sin_verificar', datos.nombre || '', datos.fecha_inicio_prueba || null, datos.fecha_vencimiento || null, datosJson
    )
    guardarSupabaseDesdeLicencia(datos.datosServidor)
    guardarEmpresaDesdeLicencia(datos.datosServidor)
  }

  function getCodigoLicenciaLocal() {
    const licencia = getLicenciaLocal()
    let datosServidor: any = null
    try {
      datosServidor = licencia?.datos_servidor ? JSON.parse(licencia.datos_servidor) : null
    } catch {
      datosServidor = null
    }
    const codigo = String(datosServidor?.licencia || datosServidor?.license_key || datosServidor?.codigo_licencia || datosServidor?.codigo || '').trim().toUpperCase()
    return /^[A-Z0-9]{5}-[A-Z0-9]{5}(-[A-Z0-9]{5})?$/.test(codigo) ? codigo : ''
  }

  function normalizarMac(valor: any) {
    return String(valor || '').replace(/[^0-9A-F]/gi, '').toUpperCase()
  }

  function obtenerDispositivosLicencia(dispositivos: any): string[] {
    if (Array.isArray(dispositivos)) return dispositivos.map(normalizarMac).filter(Boolean)
    if (dispositivos && typeof dispositivos === 'object') return Object.values(dispositivos).map(normalizarMac).filter(Boolean)

    const texto = String(dispositivos || '').trim()
    if (!texto) return []

    try {
      const parsed = JSON.parse(texto)
      return obtenerDispositivosLicencia(parsed)
    } catch {
      return texto.split(/[,\s;|]+/).map(normalizarMac).filter(Boolean)
    }
  }

  function validarDispositivoLicencia(datosServidor: any) {
    const mac = obtenerMacAddress()
    if (!mac) return { success: false, error: 'No se pudo identificar este equipo' }

    const dispositivos = obtenerDispositivosLicencia(datosServidor?.dispositivos)
    if (!dispositivos.includes(normalizarMac(mac))) {
      return { success: false, estado: 'equipo_no_autorizado', error: 'Este equipo no esta permitido para usar esta licencia' }
    }

    return { success: true }
  }

  function obtenerEquiposNoAutorizados(valor: any): string[] {
    if (Array.isArray(valor)) return valor.map(normalizarMac).filter(Boolean)
    if (valor && typeof valor === 'object') return Object.values(valor).map(normalizarMac).filter(Boolean)

    const texto = String(valor || '').trim()
    if (!texto) return []

    try {
      const parsed = JSON.parse(texto)
      return obtenerEquiposNoAutorizados(parsed)
    } catch {
      return texto.split(/[,\s;|]+/).map(normalizarMac).filter(Boolean)
    }
  }

  function actualizarCamposLicencia(payloadData: any, timeoutMs = 5000): Promise<any> {
    const baseUrl = getLicenciaApiUrl()
    if (!baseUrl) return Promise.resolve({ success: false, error: 'TM Cloud no configurado' })
    const uid = payloadData?.uid || payloadData?.id
    if (!uid) return Promise.resolve({ success: false, error: 'UID de licencia requerido para actualizar' })
    const token = getLicenciaWriteToken()
    const { uid: _uid, id: _id, ...updateData } = payloadData
    const payload = JSON.stringify({ ...updateData, updated_at: new Date().toISOString().replace('T', ' ').split('.')[0] })
    const urlObj = new URL(`${baseUrl}/licenses/${encodeURIComponent(String(uid))}`)

    return new Promise((resolve) => {
      let resolved = false
      const finish = (result: any) => {
        if (!resolved) {
          resolved = true
          resolve(result)
        }
      }

      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${token}`,
        },
        timeout: timeoutMs,
      }, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('error', (error) => finish({ success: false, error: error.message }))
        res.on('end', () => {
          const statusCode = res.statusCode ?? 500
          if (statusCode >= 200 && statusCode < 300) {
            finish({ success: true, data: body })
            return
          }
          finish({ success: false, error: `Error HTTP ${statusCode}: ${body}` })
        })
      })

      req.on('error', (error) => finish({ success: false, error: error.message }))
      req.setTimeout(timeoutMs, () => { req.destroy(); finish({ success: false, error: 'Tiempo de espera agotado' }) })
      req.write(payload)
      req.end()
    })
  }

  async function registrarEquipoNoAutorizado(datosServidor: any, mac: string): Promise<void> {
    const uid = datosServidor?.uid || datosServidor?.id
    const equipo = normalizarMac(mac)
    if (!uid || !equipo) return

    const actuales = obtenerEquiposNoAutorizados(datosServidor?.equipos_no_autorizados)
    if (actuales.includes(equipo)) return

    const result = await actualizarCamposLicencia({
      uid,
      equipos_no_autorizados: JSON.stringify([...actuales, equipo]),
      updated_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    })
    if (!result.success) throw new Error(result.error || 'No se pudo registrar el equipo no autorizado')
    console.log('[Licencia] Equipo no autorizado registrado:', equipo)
  }

  function verificarLicenciaOffline() {
    const licencia = getLicenciaLocal()
    if (!licencia || !licencia.licencia_equipo) return { success: false, error: 'No hay licencia registrada localmente', estado: 'sin_verificar' }
    const mac = obtenerMacAddress()
    if (!mac) return { success: false, error: 'No se pudo identificar el equipo', estado: 'error' }
    const cifrada = cifrarBase64(mac)
    const equipoLocal = licencia.licencia_equipo.replace(/:/g, '').toUpperCase()
    if (equipoLocal !== mac && equipoLocal !== mac.replace(/-/g, '') && (licencia.licencia_cifrada || '').toUpperCase() !== cifrada) {
      return { success: false, error: 'La licencia no corresponde a este equipo', estado: 'invalida' }
    }
    const estado = (licencia.estado || '').toUpperCase()
    if (estado === 'ACTIVO' || estado === 'PENDIENTE') {
      if (estado === 'ACTIVO' && licencia.ultima_verificacion) {
        if (Math.floor((Date.now() - new Date(licencia.ultima_verificacion).getTime()) / (1000 * 60 * 60 * 24)) > DIAS_GRACIA_OFFLINE) {
          return { success: false, error: 'Requiere verificacion online', estado: 'requiere_verificacion' }
        }
      }
      const diasRestantes = calcularDiasRestantes(licencia.fecha_vencimiento)
      if (diasRestantes !== null && diasRestantes <= 0) return { success: false, error: 'Licencia vencida', estado: 'vencida' }
      return { success: true, estado: estado.toLowerCase(), diasRestantes }
    }
    return { success: false, error: 'Estado de licencia desconocido', estado: licencia.estado }
  }

  function normalizarEstado(estado: string): string {
    const map: Record<string, string> = {
      active: 'ACTIVO', activo: 'ACTIVO',
      pending: 'PENDIENTE', pendiente: 'PENDIENTE',
      expired: 'VENCIDA', vencida: 'VENCIDA', vencido: 'VENCIDA',
      blocked: 'BLOQUEADA', bloqueada: 'BLOQUEADA',
    }
    return map[estado.toLowerCase().trim()] || estado.toUpperCase()
  }

  function parseLicenciaServerResponse(body: string, licenciaEsperada?: string, validarDispositivo = true): any {
    let data = JSON.parse(body)
    if (Array.isArray(data)) data = data.find((item: any) => item && typeof item === 'object') || null
    if (data?.data) data = data.data
    if (data && (data.id || data.uid || data.licencia || data.license_key || data.nombre)) {
      data.estado = normalizarEstado(data.status || data.estado || '')
      if (validarDispositivo) {
        const dispositivo = validarDispositivoLicencia(data)
        if (!dispositivo.success) {
          return { success: false, estado: dispositivo.estado || 'invalida', error: dispositivo.error, data }
        }
      }
      return { success: true, data }
    }
    return { success: false, error: 'Licencia no registrada en el servidor', data: null }
  }

  function buscarLicenciaServidor(licencia: string, validarCoincidencia = false, validarDispositivo = true, timeoutMs = 5000): Promise<any> {
    const url = `https://api.tmposystem.com/licenses/info?license_key=${encodeURIComponent(licencia)}`
    return new Promise((resolve) => {
      let resolved = false
      const finish = (payload: any) => { if (!resolved) { resolved = true; resolve(payload) } }
      const urlObj = new URL(url)
      const req = https.request({ hostname: urlObj.hostname, port: 443, path: urlObj.pathname + urlObj.search, method: 'GET', headers: { 'Accept': '*/*' }, timeout: timeoutMs }, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}`, data: null }))
        res.on('end', () => {
          try {
            const statusCode = res.statusCode ?? 500
            if (statusCode < 200 || statusCode >= 300) {
              let errMsg = body
              try { const j = JSON.parse(body); errMsg = j.error || j.message || body } catch {}
              finish({ success: false, error: errMsg, data: null, estado: 'error_servidor' })
              return
            }
            const parsed = parseLicenciaServerResponse(body, validarCoincidencia ? licencia : undefined, validarDispositivo)
            if (parsed.success && parsed.data) {
              guardarCredencialesTmCloud(parsed.data)
            }
            finish(parsed)
          } catch {
            finish({ success: false, error: 'Respuesta invalida del servidor', data: null })
          }
        })
      })
      req.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}`, data: null }))
      req.setTimeout(timeoutMs, () => { req.destroy(); finish({ success: false, error: 'Tiempo de espera agotado', data: null }) })
      req.end()
    })
  }

  function getEmailEmpresa() {
    const empresa = db!.prepare(`
      SELECT email
      FROM empresa
      WHERE email IS NOT NULL AND TRIM(email) <> ''
      ORDER BY id DESC
      LIMIT 1
    `).get() as any
    return String(empresa?.email || '').trim()
  }

  function ocultarEmail(email: string) {
    const [usuario, dominio] = email.split('@')
    if (!usuario || !dominio) return email
    const visible = usuario.slice(0, Math.min(2, usuario.length))
    return `${visible}${'*'.repeat(Math.max(3, usuario.length - visible.length))}@${dominio}`
  }

  function getCodigoRegistroEquipo(codigo?: string) {
    const manual = String(codigo || '').trim().toUpperCase()
    if (/^[A-Z0-9]{5}-[A-Z0-9]{5}(-[A-Z0-9]{5})?$/.test(manual)) return manual
    return getCodigoLicenciaLocal()
  }

  async function buscarLicenciaParaRegistroEquipo(codigo?: string) {
    const licencia = getCodigoRegistroEquipo(codigo)
    if (!licencia) return { success: false, error: 'Introduce la licencia primero' }

    const result = await buscarLicenciaServidor(licencia, false, false)
    if (!result.success || !result.data) return { success: false, error: result.error || 'Licencia no encontrada' }

    const mac = obtenerMacAddress()
    const equipo = normalizarMac(mac)
    if (!equipo) return { success: false, error: 'No se pudo identificar este equipo' }

    const dispositivos = obtenerDispositivosLicencia(result.data.dispositivos)
    if (dispositivos.includes(equipo)) {
      const d = result.data
      guardarLicenciaLocal({ estado: (d.estado || d.status || '').toUpperCase(), nombre: d.nombre || d.almacen || '', fecha_inicio_prueba: d.created_at || d.fecha_inicio, fecha_vencimiento: d.proximopago || d.fecha_vencimiento, datosServidor: d })
      return { success: true, yaRegistrado: true, mensaje: 'Este equipo ya esta registrado' }
    }

    await registrarEquipoNoAutorizado(result.data, equipo)
    return { success: true, pendiente: true, mensaje: 'Solicitud enviada. Espera a que el administrador active tu equipo.' }
  }

  async function enviarEmailOtpEquipo(email: string, codigo: string, mac: string) {
    const config = getOtpEmailConfig()
    if (!config.activo) return { success: false, error: 'Correo desactivado en configuracion' }
    if (!config.email || !config.password) return { success: false, error: 'Configuracion de correo incompleta' }

    const html = `
      <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f3f4f6;padding:28px 0">
          <tr>
            <td align="center" style="padding:28px 12px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(17,24,39,.10)">
                <tr>
                  <td style="background:#111827;padding:24px 28px">
                    <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#93c5fd">TM POS System</div>
                    <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;color:#ffffff">Activacion de equipo</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px">
                    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151">
                      Se solicito autorizar este equipo para usar la licencia de su sistema. Introduce el siguiente codigo en la pantalla de activacion.
                    </p>

                    <div style="margin:24px 0;padding:22px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center">
                      <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;margin-bottom:10px">Codigo de verificacion</div>
                      <div style="font-size:36px;line-height:1;font-weight:800;letter-spacing:12px;color:#111827">${codigo}</div>
                    </div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px">
                      <tr>
                        <td style="padding:14px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb">Equipo</td>
                        <td style="padding:14px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${mac}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 16px;font-size:13px;color:#6b7280">Vigencia</td>
                        <td style="padding:14px 16px;font-size:13px;color:#111827;text-align:right;font-weight:700">10 minutos</td>
                      </tr>
                    </table>

                    <div style="margin-top:22px;padding:14px 16px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.5">
                      Si no solicitaste esta activacion, ignora este correo. El equipo no se registrara sin este codigo.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
                    Este mensaje fue enviado automaticamente por TM POS System.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`
    const attempts: Array<{ host: string; port: number; secure: boolean; label: string }> = []
    if (config.host && config.puerto) {
      const secure = String(config.seguridad).toLowerCase().includes('ssl') || Number(config.puerto) === 465
      attempts.push({ host: config.host, port: Number(config.puerto), secure, label: `${config.host}:${config.puerto}` })
    }
    attempts.push({ host: 'smtp.gmail.com', port: 587, secure: false, label: 'gmail 587' })
    attempts.push({ host: 'smtp.gmail.com', port: 465, secure: true, label: 'gmail 465' })

    let lastError: any = null
    for (const attempt of attempts) {
      try {
        await sendEmail(email, 'Codigo para activar equipo', html, attempt.host, attempt.port, attempt.secure, config)
        return { success: true, label: attempt.label }
      } catch (error: any) {
        lastError = error
      }
    }
    return { success: false, error: lastError?.message || 'No se pudo enviar el correo' }
  }

  function getDatosServidorLicenciaLocal() {
    const row = getLicenciaLocal()
    try {
      return row?.datos_servidor ? JSON.parse(row.datos_servidor) : null
    } catch {
      return null
    }
  }

  async function enviarEmailOtpVisualizacionLicencia(email: string, codigo: string) {
    const config = getOtpEmailConfig()
    if (!config.email || !config.password) return { success: false, error: 'Configuracion de correo incompleta' }

    const html = `
      <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f3f4f6;padding:28px 0">
          <tr>
            <td align="center" style="padding:28px 12px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(17,24,39,.10)">
                <tr>
                  <td style="background:#111827;padding:24px 28px">
                    <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#93c5fd">TM POS System</div>
                    <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;color:#ffffff">Codigo para ver licencia</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px">
                    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151">
                      Se solicito mostrar el codigo de licencia del sistema. Introduce este codigo para autorizar la visualizacion.
                    </p>
                    <div style="margin:24px 0;padding:22px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center">
                      <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;margin-bottom:10px">Codigo de verificacion</div>
                      <div style="font-size:36px;line-height:1;font-weight:800;letter-spacing:12px;color:#111827">${codigo}</div>
                    </div>
                    <div style="margin-top:22px;padding:14px 16px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.5">
                      Este codigo vence en 10 minutos. Si no solicitaste ver la licencia, ignora este correo.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
                    Este mensaje fue enviado automaticamente por TM POS System.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`

    let lastError: any = null
    for (const attempt of [
      { host: config.host, port: Number(config.puerto), secure: false },
      { host: 'smtp.gmail.com', port: 465, secure: true },
    ]) {
      try {
        await sendEmail(email, 'Codigo para ver licencia', html, attempt.host, attempt.port, attempt.secure, config)
        return { success: true }
      } catch (error: any) {
        lastError = error
      }
    }
    return { success: false, error: lastError?.message || 'No se pudo enviar el correo' }
  }

  async function enviarEmailOtpEliminarFactura(email: string, codigo: string, factura: any) {
    const config = getOtpEmailConfig()
    if (!config.email || !config.password) return { success: false, error: 'Configuracion de correo incompleta' }

    const cantidad = Number(factura?.cantidad || 1)
    const entidad = String(factura?.entidad || 'factura')
    const entidadPlural = String(factura?.entidadPlural || `${entidad}s`)
    const noFactura = cantidad > 1 ? `${cantidad} ${entidadPlural} seleccionadas` : String(factura?.no_factura || factura?.id || '').trim() || 'Sin numero'
    const cliente = cantidad > 1 ? 'Eliminacion multiple' : String(factura?.nombre_cliente || 'Sin cliente').trim()
    const total = Number(factura?.total || 0).toFixed(2)
    const html = `
      <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f3f4f6;padding:28px 0">
          <tr>
            <td align="center" style="padding:28px 12px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(17,24,39,.10)">
                <tr>
                  <td style="background:#7f1d1d;padding:24px 28px">
                    <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fecaca">TM POS System</div>
                    <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;color:#ffffff">Autorizacion para eliminar ${entidad}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px">
                    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151">
                      Se solicito eliminar ${cantidad > 1 ? entidadPlural : `una ${entidad}`} del sistema. Introduce este codigo para confirmar la accion.
                    </p>
                    <div style="margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
                      <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">${entidad.charAt(0).toUpperCase() + entidad.slice(1)} <strong style="color:#111827">${noFactura}</strong></div>
                      <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">Cliente <strong style="color:#111827">${cliente}</strong></div>
                      <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">Total <strong style="color:#111827">RD$ ${total}</strong></div>
                      <div style="padding:12px 16px;font-size:13px;color:#6b7280">Cantidad <strong style="color:#111827">${cantidad}</strong></div>
                    </div>
                    <div style="margin:24px 0;padding:22px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;text-align:center">
                      <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b91c1c;margin-bottom:10px">Codigo de verificacion</div>
                      <div style="font-size:36px;line-height:1;font-weight:800;letter-spacing:12px;color:#111827">${codigo}</div>
                    </div>
                    <div style="margin-top:22px;padding:14px 16px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.5">
                      Este codigo vence en 10 minutos. Si no solicitaste eliminar esta factura, revisa el acceso al sistema.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
                    Este mensaje fue enviado automaticamente por TM POS System.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`

    let lastError: any = null
    for (const attempt of [
      { host: config.host, port: Number(config.puerto), secure: false },
      { host: 'smtp.gmail.com', port: 465, secure: true },
    ]) {
      try {
        await sendEmail(email, `Codigo para eliminar ${entidad}`, html, attempt.host, attempt.port, attempt.secure, config)
        return { success: true }
      } catch (error: any) {
        lastError = error
      }
    }
    return { success: false, error: lastError?.message || 'No se pudo enviar el correo' }
  }

  async function verificarLicenciaOnline(timeoutMs = 5000): Promise<any> {
    const mac = obtenerMacAddress()
    if (!mac) return { success: false, error: 'Sin conexion: no se pudo identificar el equipo', data: null }
    const cifrada = cifrarBase64(mac)
    return buscarLicenciaServidor(cifrada, true, true, timeoutMs)
  }

  function esErrorConexion(error: string) { return error && (error.startsWith('Sin conexion:') || error.startsWith('Tiempo de espera')) }

  async function verificarLicenciaCompleta(): Promise<any> {
    const VERIFY_TIMEOUT = 3000
    const codigoLocal = getCodigoLicenciaLocal()
    if (codigoLocal) {
      const localLicencia = getLicenciaLocal()
      const vencimiento = localLicencia?.fecha_vencimiento
      const estadoLocal = (localLicencia?.estado || '').toUpperCase()
      if (estadoLocal === 'ACTIVO' || estadoLocal === 'PENDIENTE') {
        const dias = calcularDiasRestantes(vencimiento)
        if (dias === null || dias > 0) {
          const online = await buscarLicenciaServidor(codigoLocal, false, true, VERIFY_TIMEOUT)
          if (online.success && online.data) {
            const d = online.data
            guardarLicenciaLocal({ estado: (d.estado || d.status || '').toUpperCase(), nombre: d.nombre || d.almacen || '', fecha_inicio_prueba: d.created_at || d.fecha_inicio, fecha_vencimiento: d.proximopago || d.fecha_vencimiento, datosServidor: d })
            const mensajeDias = dias !== null ? `${dias} dia(s) restantes` : 'sin vencimiento'
            return { success: true, estado: estadoLocal.toLowerCase(), mensaje: `Licencia verificada - ${mensajeDias}`, diasRestantes: dias, nombreEmpresa: d.nombre || localLicencia?.nombre_empresa, verificadoOnline: true }
          }
          if (online.estado === 'equipo_no_autorizado') {
            return { success: false, estado: 'equipo_no_autorizado', mensaje: online.error || 'Este equipo no esta autorizado para usar esta licencia', codigoLicencia: online.data?.license_key || codigoLocal || '', verificadoOnline: true }
          }
          if (esErrorConexion(online.error)) {
            const mensajeDias = dias !== null ? `${dias} dia(s) restantes` : 'sin vencimiento'
            return { success: true, estado: estadoLocal.toLowerCase(), mensaje: estadoLocal === 'ACTIVO' ? `Licencia activa - ${mensajeDias}` : `Periodo de prueba: ${mensajeDias}`, diasRestantes: dias, nombreEmpresa: localLicencia?.nombre_empresa, verificadoOnline: false }
          }
          return { success: false, estado: 'no_encontrada', mensaje: online.error || 'Licencia no encontrada en el servidor', verificadoOnline: true }
        }
      }
    }
    let online: any = await verificarLicenciaOnline(VERIFY_TIMEOUT)
    if (!online.success && !esErrorConexion(online.error)) {
      const mac = obtenerMacAddress()
      if (mac) online = await buscarLicenciaServidor(mac, false, true, VERIFY_TIMEOUT)
    }
    if (online.success && online.data) {
      const d = online.data
      const estado = (d.estado || d.status || '').toUpperCase()
      const vencimiento = d.proximopago || d.fecha_vencimiento
      guardarLicenciaLocal({ estado, nombre: d.nombre || d.almacen || '', fecha_inicio_prueba: d.created_at || d.fecha_inicio, fecha_vencimiento: vencimiento, datosServidor: d })
      if (estado === 'ACTIVO' || estado === 'PENDIENTE') {
        const dias = calcularDiasRestantes(vencimiento)
        if (dias !== null && dias <= 0) return { success: false, estado: 'vencida', mensaje: 'Licencia vencida', verificadoOnline: true }
        const mensajeDias = dias !== null ? `${dias} dia(s) restantes` : 'sin vencimiento'
        return { success: true, estado: estado === 'ACTIVO' ? 'activo' : 'pendiente', mensaje: estado === 'ACTIVO' ? `Licencia activa - ${mensajeDias}` : `Periodo de prueba: ${mensajeDias}`, diasRestantes: dias, nombreEmpresa: d.nombre, verificadoOnline: true }
      }
      return { success: false, estado: estado.toLowerCase(), mensaje: `Estado: ${estado}`, verificadoOnline: true }
    }
    if (online.estado === 'equipo_no_autorizado') {
      return { success: false, estado: 'equipo_no_autorizado', mensaje: online.error || 'Este equipo no esta autorizado para usar esta licencia', codigoLicencia: online.data?.license_key || '', verificadoOnline: true }
    }
    const licencia = getLicenciaLocal()
    const estadoLocal = (licencia?.estado || '').toUpperCase()

    if (esErrorConexion(online.error)) {
      if (estadoLocal === 'SIN_VERIFICAR' || !licencia?.licencia_equipo) {
        const mac = obtenerMacAddress()
        if (mac) {
          const cifrada = cifrarBase64(mac)
          const fechaVenc = new Date(Date.now() + DIAS_PRUEBA * 86400000).toISOString().replace('T', ' ').split('.')[0]
          const now = new Date().toISOString().replace('T', ' ').split('.')[0]
          db!.prepare(`INSERT INTO licencia (id, licencia_equipo, licencia_cifrada, estado, fecha_inicio_prueba, fecha_vencimiento, ultima_verificacion, updated_at) VALUES (1, ?, ?, 'PENDIENTE', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET licencia_equipo = COALESCE(excluded.licencia_equipo, licencia_equipo), licencia_cifrada = COALESCE(excluded.licencia_cifrada, licencia_cifrada), estado = excluded.estado, fecha_inicio_prueba = excluded.fecha_inicio_prueba, fecha_vencimiento = excluded.fecha_vencimiento, ultima_verificacion = excluded.ultima_verificacion, updated_at = excluded.updated_at`).run(mac, cifrada, now, fechaVenc)
          return { success: true, estado: 'pendiente', mensaje: `Periodo de prueba: ${DIAS_PRUEBA} dia(s) restantes`, diasRestantes: DIAS_PRUEBA, verificadoOnline: false }
        }
      }
      const offline = verificarLicenciaOffline()
      if (offline.success) return { ...offline, verificadoOnline: false, mensaje: offline.estado === 'pendiente' ? `Periodo de prueba: ${offline.diasRestantes} dia(s) restantes` : 'Licencia activa (offline)' }
      return { success: false, estado: offline.estado || 'sin_verificar', mensaje: online.error || offline.error || 'Sin conexion y sin licencia local', verificadoOnline: false }
    }

    if (online.error && !esErrorConexion(online.error)) {
      return { success: false, estado: 'equipo_no_autorizado', mensaje: online.error, verificadoOnline: true }
    }

    return { success: false, estado: 'no_encontrada', mensaje: online.error || 'Licencia no encontrada en el servidor', verificadoOnline: true }
  }

  async function registrarLicenciaOnline(payload: any): Promise<any> {
    const baseUrl = getLicenciaApiUrl()
    if (!baseUrl) return { success: false, error: 'TM Cloud no configurado. Configura TM Cloud en Configuracion.' }
    const token = getLicenciaWriteToken()
    const body = JSON.stringify({
      system_name: payload.nombre || payload.system_name || '',
      max_uses: payload.max_uses || 1,
      expires_at: payload.proximopago || payload.expires_at || '',
      licencia: payload.licencia || '',
      estado: payload.estado || 'PENDIENTE',
      tipo: payload.tipo || 'UN_EQUIPO',
      dispositivos: payload.dispositivos || '',
      nombre: payload.nombre || '',
      encargado: payload.encargado || '',
      telefono: payload.telefono || '',
      email: payload.email || '',
      direccion: payload.direccion || '',
      precio: payload.precio || '0.00',
    })
    const url = `${baseUrl}/licenses`
    return new Promise((resolve) => {
      let resolved = false
      const finish = (r: any) => { if (!resolved) { resolved = true; resolve(r) } }
      const urlObj = new URL(url)
      const req = https.request({ hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST', headers: { 'Accept': '*/*', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Authorization': `Bearer ${token}` }, timeout: 15000 }, (res) => {
        let responseBody = ''
        res.on('data', chunk => responseBody += chunk)
        res.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}` }))
        res.on('end', () => {
          let parsed: any = responseBody
          try { parsed = responseBody ? JSON.parse(responseBody) : null } catch { parsed = responseBody }
          const statusCode = res.statusCode ?? 500
          const registrado = statusCode >= 200 && statusCode < 300 && ((Array.isArray(parsed) && parsed[0] === 'ok') || (parsed && typeof parsed === 'object' && (parsed.id || parsed.success || parsed.ok)) || parsed === 'ok')
          if (!registrado) { finish({ success: false, error: (parsed && typeof parsed === 'object' ? parsed.message || parsed.error : null) || `Error HTTP ${statusCode}`, data: parsed }); return }
          finish({ success: true, data: parsed })
        })
      })
      req.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}` }))
      req.setTimeout(15000, () => { req.destroy(); finish({ success: false, error: 'Tiempo de espera agotado' }) })
      req.write(body)
      req.end()
    })
  }

  function conectarDispositivoLicencia(licenseKey: string, deviceId: string, timeoutMs = 15000): Promise<any> {
    const body = JSON.stringify({ license_key: licenseKey, device_id: deviceId })
    const url = 'https://api.tmposystem.com/api/license/connect'
    return new Promise((resolve) => {
      let resolved = false
      const finish = (r: any) => { if (!resolved) { resolved = true; resolve(r) } }
      const urlObj = new URL(url)
      const req = https.request({ hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST', headers: { 'Accept': '*/*', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: timeoutMs }, (res) => {
        let responseBody = ''
        res.on('data', chunk => responseBody += chunk)
        res.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}` }))
        res.on('end', () => {
          let parsed: any = responseBody
          try { parsed = responseBody ? JSON.parse(responseBody) : null } catch { parsed = responseBody }
          const statusCode = res.statusCode ?? 500
          if (statusCode >= 200 && statusCode < 300 && parsed?.success && parsed?.data) {
            if (parsed.data) guardarCredencialesTmCloud(parsed.data)
            finish({ success: true, data: parsed.data, device_registered: parsed.device_registered, devices: parsed.devices })
          } else {
            finish({ success: false, error: (parsed && typeof parsed === 'object' ? parsed.message || parsed.error : null) || `Error HTTP ${statusCode}` })
          }
        })
      })
      req.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}` }))
      req.setTimeout(timeoutMs, () => { req.destroy(); finish({ success: false, error: 'Tiempo de espera agotado' }) })
      req.write(body)
      req.end()
    })
  }

  function crearProyectoServidor(nombre: string, systemName: string, timeoutMs = 20000): Promise<any> {
    const body = JSON.stringify({ name: nombre, system_name: systemName })
    const url = 'https://api.tmposystem.com/api/project/create'
    return new Promise((resolve) => {
      let resolved = false
      const finish = (r: any) => { if (!resolved) { resolved = true; resolve(r) } }
      const urlObj = new URL(url)
      const req = https.request({ hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST', headers: { 'Accept': '*/*', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: timeoutMs }, (res) => {
        let responseBody = ''
        res.on('data', chunk => responseBody += chunk)
        res.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}` }))
        res.on('end', () => {
          let parsed: any = responseBody
          try { parsed = responseBody ? JSON.parse(responseBody) : null } catch { parsed = responseBody }
          const statusCode = res.statusCode ?? 500
          if (statusCode >= 200 && statusCode < 300) {
            const data = parsed?.data || parsed
            if (data) {
              guardarCredencialesTmCloud(data)
              guardarEmpresaDesdeLicencia(data)
              guardarLicenciaLocal({ estado: (data.estado || data.status || 'ACTIVO').toUpperCase(), nombre: data.nombre || nombre, fecha_inicio_prueba: data.created_at || data.fecha_inicio || new Date().toISOString().replace('T', ' ').split('.')[0], fecha_vencimiento: data.proximopago || data.fecha_vencimiento, datosServidor: data })
            }
            finish({ success: true, data: parsed?.data || parsed })
          } else {
            finish({ success: false, error: (parsed && typeof parsed === 'object' ? parsed.message || parsed.error : null) || `Error HTTP ${statusCode}` })
          }
        })
      })
      req.on('error', (error) => finish({ success: false, error: `Sin conexion: ${error.message}` }))
      req.setTimeout(timeoutMs, () => { req.destroy(); finish({ success: false, error: 'Tiempo de espera agotado' }) })
      req.write(body)
      req.end()
    })
  }

  ipcMain.handle('licencia:getMacAddress', async () => {
    try {
      const mac = obtenerMacAddress()
      if (!mac) return { success: false, error: 'No se pudo identificar el equipo' }
      return { success: true, data: { mac, cifrada: cifrarBase64(mac) } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('licencia:getInfo', async () => {
    try {
      const row = db!.prepare(`SELECT * FROM licencia WHERE id = 1`).get() as any
      const mac = obtenerMacAddress()
      const estado = (row?.estado || 'sin_verificar').toUpperCase()
      let datosServidor: any = null
      try { datosServidor = row?.datos_servidor ? JSON.parse(row.datos_servidor) : null } catch {}
      const codigoLicencia = String(datosServidor?.licencia || datosServidor?.codigo_licencia || datosServidor?.codigo || '').trim().toUpperCase()
      let estadoDisplay = 'Sin verificar'
      if (estado === 'ACTIVO') estadoDisplay = 'Activa'
      else if (estado === 'PENDIENTE') estadoDisplay = 'Pendiente'
      return { success: true, data: { licencia: codigoLicencia, licencia_equipo: mac || '', licencia_cifrada: mac ? cifrarBase64(mac) : '', estado: (row?.estado || 'sin_verificar'), estado_display: estadoDisplay, nombre_empresa: row?.nombre_empresa || '', dias_restantes: calcularDiasRestantes(row?.fecha_vencimiento), ultima_verificacion: row?.ultima_verificacion || '', fecha_vencimiento: row?.fecha_vencimiento || '' } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('licencia:setApiKey', async (_event, apiKey: string) => {
    try {
      if (!apiKey || apiKey.trim() === '') return { success: false, error: 'API Key no puede estar vacia' }
      db!.prepare(`UPDATE licencia SET api_key = ?, updated_at = datetime('now','localtime') WHERE id = 1`).run(apiKey.trim())
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('licencia:getApiKey', async () => {
    try {
      const row = db!.prepare(`SELECT api_key FROM licencia WHERE id = 1`).get() as any
      return { success: true, data: { configurada: !!row?.api_key } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  function logLic(msg: string) {
    try { require('fs').appendFileSync(require('path').join(app.getPath('userData'), 'licencia_debug.log'), `[${new Date().toISOString()}] ${msg}\n`) } catch {}
  }

  ipcMain.handle('licencia:registrar', async (_event, payload: any) => {
    try {
      logLic(`Payload recibido: ${JSON.stringify(payload)}`)
      const result = await registrarLicenciaOnline(payload)
      logLic(`Resultado online: ${JSON.stringify(result)}`)
      const d = result.success && result.data ? (Array.isArray(result.data) ? result.data[0] : result.data) : null
      logLic(`d extraido: ${JSON.stringify(d)}`)
      if (d) {
        logLic('Guardando con datos del servidor')
        guardarLicenciaLocal({ estado: 'PENDIENTE', nombre: payload.nombre || '', fecha_inicio_prueba: new Date().toISOString().replace('T', ' ').split('.')[0], fecha_vencimiento: payload.proximopago, datosServidor: { ...d, licencia: payload.licencia } })
        logLic('Guardado exitoso con datos del servidor')
        return { success: true, data: { mensaje: 'Licencia registrada correctamente' } }
      }
      logLic('Guardando local offline')
      const mac = obtenerMacAddress()
      const cifrada = mac ? cifrarBase64(mac) : ''
      const now = new Date().toISOString().replace('T', ' ').split('.')[0]
      const fechaVenc = payload.proximopago || new Date(Date.now() + DIAS_PRUEBA * 86400000).toISOString().replace('T', ' ').split('.')[0]
      const datos = JSON.stringify({ licencia: payload.licencia, nombre: payload.nombre, encargado: payload.encargado, telefono: payload.telefono, email: payload.email, direccion: payload.direccion || '' })
      db!.prepare(`INSERT INTO licencia (id, licencia_equipo, licencia_cifrada, estado, nombre_empresa, fecha_inicio_prueba, fecha_vencimiento, ultima_verificacion, datos_servidor, updated_at) VALUES (1, ?, ?, 'PENDIENTE', ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET licencia_equipo = COALESCE(excluded.licencia_equipo, licencia_equipo), licencia_cifrada = COALESCE(excluded.licencia_cifrada, licencia_cifrada), estado = excluded.estado, nombre_empresa = excluded.nombre_empresa, fecha_inicio_prueba = excluded.fecha_inicio_prueba, fecha_vencimiento = excluded.fecha_vencimiento, ultima_verificacion = excluded.ultima_verificacion, datos_servidor = excluded.datos_servidor, updated_at = excluded.updated_at`).run(
        mac || null, cifrada || null, payload.nombre || '', now, fechaVenc, datos
      )
      logLic('INSERT/UPDATE ejecutado correctamente')
      return { success: true, data: { mensaje: d ? 'Licencia registrada correctamente' : 'Licencia registrada en modo offline. Se sincronizara cuando haya conexion.' } }
    } catch (e: any) {
      logLic(`ERROR: ${e.message}`)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('licencia:guardarLocal', async (_event, payload: any) => {
    try {
      const mac = obtenerMacAddress()
      const cifrada = mac ? cifrarBase64(mac) : ''
      const now = new Date().toISOString().replace('T', ' ').split('.')[0]
      const fechaVenc = payload.proximopago || new Date(Date.now() + DIAS_PRUEBA * 86400000).toISOString().replace('T', ' ').split('.')[0]
      const datosServidor = { licencia: payload.licencia, nombre: payload.nombre, encargado: payload.encargado, telefono: payload.telefono, email: payload.email, direccion: payload.direccion || '' }
      db!.prepare(`UPDATE licencia SET estado = 'ACTIVO', licencia_equipo = COALESCE(?, licencia_equipo), licencia_cifrada = COALESCE(?, licencia_cifrada), nombre_empresa = ?, fecha_inicio_prueba = ?, fecha_vencimiento = ?, ultima_verificacion = CURRENT_TIMESTAMP, datos_servidor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(
        mac || null, cifrada || null, payload.nombre || '', now, fechaVenc, JSON.stringify(datosServidor)
      )
      return { success: true, data: { mensaje: 'Licencia registrada correctamente' } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('tmcloud:getConfig', async () => {
    try {
      const row = db!.prepare(`SELECT url, public_key, secret_key FROM tmcloud_config WHERE id = 1`).get() as any
      return { success: true, data: row || { url: '', public_key: '', secret_key: '' } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('tmcloud:saveConfig', async (_event, payload: { url: string; public_key: string; secret_key: string }) => {
    try {
      db!.prepare(`UPDATE tmcloud_config SET url = ?, public_key = ?, secret_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(
        payload.url || '', payload.public_key || '', payload.secret_key || ''
      )
      db!.prepare(`DELETE FROM configuracion WHERE clave IN ('supabase_url', 'supabase_anon_key', 'supabase_service_role', 'tmcloud_url', 'tmcloud_key', 'tmcloud_service_key')`).run()
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('caja:getTurnoAbierto', async () => {
    try {
      const row = db!.prepare(`SELECT * FROM caja_turnos WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1`).get() as any
      return { success: true, data: row || null }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('caja:abrirTurno', async (_event, data: { monto_inicial: number; observacion?: string; usuario_id: number; usuario_nombre: string }) => {
    try {
      const now = new Date().toISOString()
      const info = db!.prepare(`INSERT INTO caja_turnos (monto_inicial, entradas, retiros, estado, observacion, usuario_id, usuario_nombre, created_at, updated_at) VALUES (?, 0, 0, 'abierto', ?, ?, ?, ?, ?)`).run(
        data.monto_inicial || 0, data.observacion || '', data.usuario_id || 0, data.usuario_nombre || '', now, now
      )
      return { success: true, data: { id: info.lastInsertRowid } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('caja:cerrarTurno', async (_event, turnoId: number) => {
    try {
      db!.prepare(`UPDATE caja_turnos SET estado = 'cerrado', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND estado = 'abierto'`).run(turnoId)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('caja:getTurnoActivo', async () => {
    try {
      const row = db!.prepare(`SELECT id FROM caja_turnos WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1`).get() as any
      return { success: true, data: row || null }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('cuadre:listar', async () => {
    try {
      const rows = db!.prepare(`SELECT * FROM cuadres ORDER BY created_at DESC`).all()
      return { success: true, data: rows }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('cuadre:ventasTurno', async () => {
    try {
      const turno = db!.prepare(`SELECT id, created_at FROM caja_turnos WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1`).get() as any
      if (!turno) return { success: true, data: { total: 0, efectivo: 0, tarjeta: 0, transferencia: 0 } }
      const desde = turno.created_at
      const facturas = db!.prepare(`SELECT metodo_pago, total, efectivo, tarjeta, transferencia FROM facturas WHERE estado_factura = 'PAGADA' AND created_at >= ?`).all(desde) as any[]
      let total = 0, efectivo = 0, tarjeta = 0, transferencia = 0
      for (const f of facturas) {
        total += Number(f.total || 0)
        efectivo += Number(f.efectivo || 0)
        tarjeta += Number(f.tarjeta || 0)
        transferencia += Number(f.transferencia || 0)
      }
      return { success: true, data: { total, efectivo, tarjeta, transferencia } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('cuadre:gastosTurno', async () => {
    try {
      const turno = db!.prepare(`SELECT id, created_at FROM caja_turnos WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1`).get() as any
      if (!turno) return { success: true, data: { total: 0 } }
      const desde = turno.created_at
      const rows = db!.prepare(`SELECT cantidad FROM gastos WHERE created_at >= ?`).all(desde) as any[]
      let total = 0
      for (const r of rows) total += Number(r.cantidad || 0)
      return { success: true, data: { total } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('cuadre:realizar', async (_event, data: any) => {
    try {
      data.fecha = new Date().toISOString().split('T')[0]
      const keys = Object.keys(data)
      const vals = Object.values(data)
      db!.prepare(`INSERT INTO cuadres (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('licencia:introducirCodigo', async (_event, codigo: string) => {
    try {
      const licencia = String(codigo || '').trim().toUpperCase()
      if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(licencia)) {
        return { success: false, error: 'Formato de licencia invalido. Usa XXXXX-XXXXX-XXXXX' }
      }

      console.log('[LicenciaManual] Buscando licencia:', `${licencia.slice(0, 2)}***-${licencia.slice(6, 8)}***`)
      const result = await buscarLicenciaServidor(licencia, false)
      console.log('[LicenciaManual] Respuesta servidor:', JSON.stringify(result))
      if (!result.success || !result.data) {
        return { success: false, estado: result.estado, error: result.error || 'Licencia no encontrada' }
      }

      const d = result.data
      const estado = (d.estado || d.status || '').toUpperCase()
      const vencimiento = d.proximopago || d.fecha_vencimiento
      guardarLicenciaLocal({ estado, nombre: d.nombre || d.almacen || '', fecha_inicio_prueba: d.created_at || d.fecha_inicio, fecha_vencimiento: vencimiento, datosServidor: d })

      const ok = estado === 'ACTIVO' || estado === 'PENDIENTE'
      return {
        success: ok,
        estado: estado.toLowerCase(),
        data: {
          estado: estado.toLowerCase(),
          mensaje: ok ? `Licencia ${estado.toLowerCase()} registrada en este equipo` : `Estado: ${estado}`,
        },
      }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('licencia:solicitarRegistroEquipo', async (_event, payload: { licencia?: string } = {}) => {
    try {
      const result = await buscarLicenciaParaRegistroEquipo(payload?.licencia)
      if (!result.success) return result
      if (result.yaRegistrado) return { success: true, yaRegistrado: true, mensaje: 'Este equipo ya esta registrado' }
      if (result.pendiente) return { success: true, pendiente: true, mensaje: result.mensaje || 'Solicitud enviada. Espera a que el administrador active tu equipo.' }
      return { success: true, mensaje: result.mensaje || 'Equipo registrado correctamente' }
    } catch (e: any) { return { success: false, error: e.message || 'Error registrando equipo' } }
  })

  ipcMain.handle('licencia:confirmarRegistroEquipo', async (_event, payload: { licencia?: string; codigo?: string } = {}) => {
    try {
      const codigo = String(payload?.codigo || '').replace(/\D/g, '')
      if (!/^\d{4}$/.test(codigo)) return { success: false, error: 'Introduce el codigo de 4 digitos' }

      const licencia = getCodigoRegistroEquipo(payload?.licencia)
      if (!licencia) return { success: false, error: 'Introduce la licencia primero' }

      const mac = normalizarMac(obtenerMacAddress())
      if (!mac) return { success: false, error: 'No se pudo identificar este equipo' }

      const key = `${licencia}:${mac}`
      const registro = licenciaEquipoOtp.get(key)
      if (!registro) return { success: false, error: 'Solicita un codigo nuevo' }
      if (Date.now() > registro.expiresAt) {
        licenciaEquipoOtp.delete(key)
        return { success: false, error: 'El codigo vencio. Solicita uno nuevo' }
      }
      if (registro.codigo !== codigo) return { success: false, error: 'Codigo incorrecto' }

      const d = registro.datosServidor
      const id = d?.id
      if (!id) return { success: false, error: 'La licencia no tiene identificador para actualizar' }

      const dispositivos = obtenerDispositivosLicencia(d.dispositivos)
      const equiposNoAutorizados = obtenerEquiposNoAutorizados(d.equipos_no_autorizados).filter(equipo => equipo !== mac)
      const dispositivosActualizados = dispositivos.includes(mac) ? dispositivos : [...dispositivos, mac]
      const fecha = new Date().toISOString().replace('T', ' ').split('.')[0]
      const updateResult = await actualizarCamposLicencia({
        id,
        dispositivos: JSON.stringify(dispositivosActualizados),
        equipos_no_autorizados: JSON.stringify(equiposNoAutorizados),
        updated_at: fecha,
      }, 15000)
      if (!updateResult.success) return { success: false, error: updateResult.error || 'No se pudo activar este equipo' }

      const datosServidor = { ...d, dispositivos: JSON.stringify(dispositivosActualizados), equipos_no_autorizados: JSON.stringify(equiposNoAutorizados), updated_at: fecha }
      const estado = (datosServidor.estado || datosServidor.status || '').toUpperCase()
      guardarLicenciaLocal({ estado, nombre: datosServidor.nombre || datosServidor.almacen || '', fecha_inicio_prueba: datosServidor.created_at || datosServidor.fecha_inicio, fecha_vencimiento: datosServidor.proximopago || datosServidor.fecha_vencimiento, datosServidor })
      licenciaEquipoOtp.delete(key)

      return { success: true, data: { mensaje: 'Equipo activado correctamente' } }
    } catch (e: any) { return { success: false, error: e.message || 'Error activando equipo' } }
  })

  ipcMain.handle('licencia:solicitarVerCodigo', async () => {
    try {
      const licencia = getCodigoLicenciaLocal()
      if (!licencia) return { success: false, error: 'No hay una licencia registrada para mostrar' }

      const email = getEmailEmpresa()
      if (!email || !email.includes('@')) return { success: false, error: 'Configura un correo valido en los datos de la empresa' }

      const mac = normalizarMac(obtenerMacAddress()) || 'LOCAL'
      const codigo = Math.floor(1000 + Math.random() * 9000).toString()
      licenciaVisualizacionOtp.set(mac, {
        codigo,
        licencia,
        email,
        expiresAt: Date.now() + 10 * 60 * 1000,
      })

      const emailResult = await enviarEmailOtpVisualizacionLicencia(email, codigo)
      if (!emailResult.success) {
        licenciaVisualizacionOtp.delete(mac)
        return { success: false, error: emailResult.error || 'No se pudo enviar el codigo' }
      }

      return { success: true, data: { email: ocultarEmail(email), expiresMinutes: 10 } }
    } catch (e: any) { return { success: false, error: e.message || 'Error solicitando codigo' } }
  })

  ipcMain.handle('licencia:confirmarVerCodigo', async (_event, payload: { codigo?: string } = {}) => {
    try {
      const codigo = String(payload?.codigo || '').replace(/\D/g, '')
      if (!/^\d{4}$/.test(codigo)) return { success: false, error: 'Introduce el codigo de 4 digitos' }

      const mac = normalizarMac(obtenerMacAddress()) || 'LOCAL'
      const registro = licenciaVisualizacionOtp.get(mac)
      if (!registro) return { success: false, error: 'Solicita un codigo nuevo' }
      if (Date.now() > registro.expiresAt) {
        licenciaVisualizacionOtp.delete(mac)
        return { success: false, error: 'El codigo vencio. Solicita uno nuevo' }
      }
      if (registro.codigo !== codigo) return { success: false, error: 'Codigo incorrecto' }

      licenciaVisualizacionOtp.delete(mac)
      return { success: true, data: { licencia: registro.licencia } }
    } catch (e: any) { return { success: false, error: e.message || 'Error validando codigo' } }
  })

  ipcMain.handle('facturas:solicitarOtpEliminar', async (_event, factura: any = {}) => {
    try {
      const facturaIds = (Array.isArray(factura?.facturaIds) ? factura.facturaIds : [factura?.id])
        .map((id: any) => Number(id || 0))
        .filter((id: number) => id > 0)
        .sort((a: number, b: number) => a - b)
      if (facturaIds.length === 0) return { success: false, error: 'Factura invalida' }

      const email = getEmailEmpresa()
      if (!email || !email.includes('@')) return { success: false, error: 'Configura un correo valido en los datos de la empresa' }

      const mac = normalizarMac(obtenerMacAddress()) || 'LOCAL'
      const key = `${mac}:${facturaIds.join(',')}`
      const codigo = Math.floor(1000 + Math.random() * 9000).toString()
      facturaEliminacionOtp.set(key, {
        codigo,
        facturaIds,
        email,
        expiresAt: Date.now() + 10 * 60 * 1000,
      })

      const emailResult = await enviarEmailOtpEliminarFactura(email, codigo, factura)
      if (!emailResult.success) {
        facturaEliminacionOtp.delete(key)
        return { success: false, error: emailResult.error || 'No se pudo enviar el codigo' }
      }

      return { success: true, data: { email: ocultarEmail(email), expiresMinutes: 10 } }
    } catch (e: any) { return { success: false, error: e.message || 'Error solicitando codigo' } }
  })

  ipcMain.handle('facturas:confirmarOtpEliminar', async (_event, payload: { facturaId?: number; facturaIds?: number[]; codigo?: string } = {}) => {
    try {
      const facturaIds = (Array.isArray(payload?.facturaIds) ? payload.facturaIds : [payload?.facturaId])
        .map((id: any) => Number(id || 0))
        .filter((id: number) => id > 0)
        .sort((a: number, b: number) => a - b)
      const codigo = String(payload?.codigo || '').replace(/\D/g, '')
      if (facturaIds.length === 0) return { success: false, error: 'Factura invalida' }
      if (!/^\d{4}$/.test(codigo)) return { success: false, error: 'Introduce el codigo de 4 digitos' }

      const mac = normalizarMac(obtenerMacAddress()) || 'LOCAL'
      const key = `${mac}:${facturaIds.join(',')}`
      const registro = facturaEliminacionOtp.get(key)
      if (!registro) return { success: false, error: 'Solicita un codigo nuevo' }
      if (Date.now() > registro.expiresAt) {
        facturaEliminacionOtp.delete(key)
        return { success: false, error: 'El codigo vencio. Solicita uno nuevo' }
      }
      if (registro.codigo !== codigo) return { success: false, error: 'Codigo incorrecto' }

      facturaEliminacionOtp.delete(key)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message || 'Error validando codigo' } }
  })

  ipcMain.handle('transferencia:realizar', async (_event, params: { tabla: string; items: { id: number; cantidad: number }[]; origen_id: number; destino_id: number; transferencia: any }) => {
    try {
      const { tabla, items, origen_id, destino_id, transferencia } = params
      for (const item of items) {
        const row = db!.prepare(`SELECT * FROM "${tabla}" WHERE id = ?`).get(item.id) as any
        if (!row) { return { success: false, error: `Producto #${item.id} no encontrado` } }
        const stockActual = Number(row.cantidad || 0)
        if (stockActual < item.cantidad) { return { success: false, error: `${row.nombre}: stock insuficiente (${stockActual} < ${item.cantidad})` } }
        const nuevaCantidadOrigen = stockActual - item.cantidad
        db!.prepare(`UPDATE "${tabla}" SET cantidad = ? WHERE id = ?`).run(nuevaCantidadOrigen, item.id)
        const destRow = db!.prepare(`SELECT * FROM "${tabla}" WHERE id = ? AND (almacen_id = ? OR ? = 1)`).get(item.id, destino_id, destino_id) as any
        if (destRow) {
          db!.prepare(`UPDATE "${tabla}" SET cantidad = ? WHERE id = ? AND almacen_id = ?`).run(Number(destRow.cantidad || 0) + item.cantidad, item.id, destino_id)
        } else {
          const newRow = { ...row, id: undefined, cantidad: item.cantidad, almacen_id: destino_id }
          const keys = Object.keys(newRow)
          const placeholders = keys.map(() => '?').join(', ')
          const values = Object.values(newRow)
          db!.prepare(`INSERT INTO "${tabla}" (${keys.join(', ')}) VALUES (${placeholders})`).run(...values)
        }
      }
      const tk = Object.keys(transferencia)
      const tp = tk.map(() => '?').join(', ')
      const tv = Object.values(transferencia)
      db!.prepare(`INSERT INTO transferencias (${tk.join(', ')}) VALUES (${tp})`).run(...tv)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('ajuste:realizar', async (_event, params: { tabla: string; producto_id: number; cantidad_nueva: number; motivo: string; tipo: string; almacen_id: number }) => {
    try {
      const { tabla, producto_id, cantidad_nueva, motivo, tipo, almacen_id } = params
      const row = db!.prepare(`SELECT * FROM "${tabla}" WHERE id = ?`).get(producto_id) as any
      if (!row) return { success: false, error: 'Producto no encontrado' }
      const anterior = Number(row.cantidad || 0)
      const diferencia = cantidad_nueva - anterior
      db!.prepare(`UPDATE "${tabla}" SET cantidad = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(cantidad_nueva, producto_id)
      const data = { tabla, producto_id, producto_nombre: row.nombre || '', cantidad_anterior: anterior, cantidad_nueva, diferencia, tipo, motivo, usuario: '', almacen_id }
      const keys = Object.keys(data); const vals = Object.values(data)
      db!.prepare(`INSERT INTO ajustes_inventario (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals)
      return { success: true, data: { anterior, nueva: cantidad_nueva, diferencia } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('precio:registrarHistorial', async (_event, params: { tabla: string; producto_id: number; producto_nombre: string; cambios: { campo: string; anterior: any; nuevo: any }[] }) => {
    try {
      const { tabla, producto_id, producto_nombre, cambios } = params
      const stmt = db!.prepare(`INSERT INTO historial_precios (tabla, producto_id, producto_nombre, campo, valor_anterior, valor_nuevo, usuario) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      for (const c of cambios) {
        if (String(c.anterior) !== String(c.nuevo)) {
          stmt.run(tabla, producto_id, producto_nombre, c.campo, String(c.anterior || ''), String(c.nuevo || ''), '')
        }
      }
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('empresa:guardar', async (_event, data: { nombre: string; encargado: string; telefono: string; email: string }) => {
    try {
      guardarEmpresaDesdeLicencia(data)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('proyecto:crear', async (_event, data: { nombre: string; system_name: string }) => {
    try {
      const result = await crearProyectoServidor(data.nombre, data.system_name)
      if (result.success && result.data) {
        return { success: true, data: result.data }
      }
      return { success: false, error: result.error || 'No se pudo crear el proyecto' }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('licencia:fetchConfig', async (_event, codigo: string) => {
    try {
      const result = await buscarLicenciaServidor(String(codigo || '').trim().toUpperCase(), false, false)
      if (!result.success || !result.data) return { success: false, error: result.error || 'Licencia no encontrada en el servidor' }
      const d = result.data
      guardarSupabaseDesdeLicencia(d)
      guardarLicenciaLocal({ estado: (d.estado || d.status || 'PENDIENTE').toUpperCase(), nombre: d.nombre || d.almacen || '', fecha_inicio_prueba: d.created_at || d.fecha_inicio, fecha_vencimiento: d.proximopago || d.fecha_vencimiento, datosServidor: d })
      return { success: true, data: { mensaje: 'TM Cloud y datos de la empresa actualizados correctamente' } }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('licencia:verificar', async (_event, opts: { forceOnline?: boolean; offlineOnly?: boolean } = {}) => {
    try {
      const { forceOnline, offlineOnly } = opts
      if (offlineOnly) {
        const offline = verificarLicenciaOffline()
        if (offline.success) return { success: true, estado: offline.estado, data: { estado: offline.estado, mensaje: offline.estado === 'pendiente' ? `Periodo de prueba: ${offline.diasRestantes} dia(s) restantes` : 'Licencia activa' }, verificadoOnline: false }
        const estadoFinal = offline.estado === 'sin_verificar' ? 'no_encontrada' : offline.estado
        return { success: false, estado: estadoFinal, error: offline.error || 'Sin licencia local', data: { estado: estadoFinal, mensaje: offline.error || 'Sin licencia local' } }
      }
        if (forceOnline) {
        const VERIFY_TIMEOUT = 1500
        const codigoLocal = getCodigoLicenciaLocal()
        let online: any
        if (codigoLocal) {
          online = await buscarLicenciaServidor(codigoLocal, false, true, VERIFY_TIMEOUT)
        } else {
          online = await verificarLicenciaOnline(VERIFY_TIMEOUT)
          if (!online.success && !esErrorConexion(online.error)) {
            const mac = obtenerMacAddress()
            if (mac) online = await buscarLicenciaServidor(mac, false, true, VERIFY_TIMEOUT)
          }
        }
        if (online.success && online.data) {
          const d = online.data
          const estado = (d.estado || d.status || '').toUpperCase()
          guardarLicenciaLocal({ estado, nombre: d.nombre || d.almacen || '', fecha_inicio_prueba: d.created_at || d.fecha_inicio, fecha_vencimiento: d.proximopago || d.fecha_vencimiento, datosServidor: d })
          const ok = estado === 'ACTIVO' || estado === 'PENDIENTE'
          return { success: ok, estado: estado.toLowerCase(), data: { estado: estado.toLowerCase(), mensaje: `Licencia ${estado.toLowerCase()}` }, verificadoOnline: true }
        }
        if (online.estado === 'equipo_no_autorizado') {
          return { success: false, estado: 'equipo_no_autorizado', error: online.error || 'Este equipo no esta autorizado para usar esta licencia', data: { estado: 'equipo_no_autorizado', mensaje: online.error || 'Este equipo no esta autorizado para usar esta licencia', codigoLicencia: online.data?.license_key || codigoLocal || '' }, verificadoOnline: true }
        }
        return { success: false, error: online.error || 'Error verificando online', data: { estado: 'error', mensaje: online.error || 'Sin respuesta del servidor' } }
      }
      const resultado = await verificarLicenciaCompleta()
      return { success: resultado.success, estado: resultado.estado, data: resultado, verificadoOnline: resultado.verificadoOnline }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // IMEI externo
  const TOKEN_SECRET = '1234567890abc'
  function generarJWT() {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ iss: 'argentpos', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payload}`).digest('base64url')
    return `${header}.${payload}.${signature}`
  }

  ipcMain.handle('imei:consultar', async (_event, imei: string, servicio: number) => {
    try {
      const payload = { imei, servicio }
      const data = JSON.stringify(payload)
      const url = new URL('https://demo.tmposrd.com/api2/consultaimei')
      return new Promise((resolve) => {
        const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${generarJWT()}`, 'Content-Length': Buffer.byteLength(data) }, timeout: 30000 }, (res) => {
          let body = ''
          res.on('data', (chunk: string) => body += chunk)
          res.on('end', () => {
            try { resolve({ success: true, data: JSON.parse(body) }) } catch { resolve({ success: true, data: { raw: body } }) }
          })
        })
        req.on('error', (error) => resolve({ success: false, error: error.message }))
        req.setTimeout(30000, () => { req.destroy(); resolve({ success: false, error: 'Tiempo de espera agotado' }) })
        req.write(data)
        req.end()
      })
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // Impresoras
  ipcMain.handle('getPrinters', async () => {
    try {
      if (!mainWindow) return { success: false, error: 'Ventana no disponible' }
      const printers = await mainWindow.webContents.getPrintersAsync()
      return { success: true, data: printers }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // Imprimir ticket
  ipcMain.handle('print:ticket', async (_event, html: string, printerName?: string) => {
    let printWindow: BrowserWindow | null = null
    const tmpPath = path.join(app.getPath('temp'), `print-ticket-${Date.now()}.html`)
    try {
      const isFullDoc = html.includes('<!DOCTYPE html>') || html.includes('<html>')
      const hasOwnPageRule = html.includes('@page')
      const pageStyle = '<style>@page { size: 80mm 297mm; margin: 0; }</style>'
      const fullHtml = isFullDoc ? (hasOwnPageRule ? html : html.replace('<head>', `<head>${pageStyle}`)) : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page { size: 80mm 297mm; margin: 0; }body { margin: 0; padding: 0; }</style></head><body>${html}</body></html>`
      fs.writeFileSync(tmpPath, fullHtml, 'utf-8')
      printWindow = new BrowserWindow({ width: 480, height: 800, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
      await printWindow.loadFile(tmpPath)
      await new Promise(r => setTimeout(r, 1000))
      if (printerName) {
        const installedPrinters = await printWindow.webContents.getPrintersAsync()
        const searchName = printerName.trim().toLowerCase()
        const match = installedPrinters.find(printer =>
          printer.name?.trim().toLowerCase() === searchName ||
          printer.name?.trim().toLowerCase().includes(searchName)
        )
        if (!match) {
          if (printWindow) { printWindow.close(); printWindow = null }
          try { fs.unlinkSync(tmpPath) } catch {}
          return { success: false, error: `La impresora "${printerName}" no esta instalada en Windows.` }
        }
        printerName = match.name
      }
      const printOptions: any = { silent: true, printBackground: true, margins: { marginType: 'none' } }
      if (printerName) printOptions.deviceName = printerName
      return new Promise((resolve) => {
        printWindow!.webContents.print(printOptions, (success, failureReason) => {
          if (printWindow) { printWindow.close(); printWindow = null }
          try { fs.unlinkSync(tmpPath) } catch {}
          resolve(success ? { success: true } : { success: false, error: failureReason || 'Error al imprimir' })
        })
      })
    } catch (error: any) { try { fs.unlinkSync(tmpPath) } catch {}; return { success: false, error: error.message } }
  })

  ipcMain.handle('print:bluetooth-raw', async (_event, portName: string, data: string) => {
    try {
      const normalizedPort = String(portName || '').trim().toUpperCase()
      if (!/^COM\d+$/.test(normalizedPort)) return { success: false, error: 'Puerto Bluetooth invalido' }
      const encodedData = Buffer.from(String(data || ''), 'utf8').toString('base64')
      const script = `$portName = '${normalizedPort}'; $bytes = [Convert]::FromBase64String('${encodedData}'); $serial = [System.IO.Ports.SerialPort]::new($portName, 9600, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One); $serial.WriteTimeout = 8000; $serial.Open(); $serial.Write($bytes, 0, $bytes.Length); $serial.Close()`
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64')
      return await new Promise((resolve) => {
        exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`, { timeout: 12000 }, (err, _stdout, stderr) => {
          resolve(err ? { success: false, error: stderr || err.message || 'No se pudo escribir al Bluetooth' } : { success: true })
        })
      })
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // PDF
  ipcMain.handle('generate:pdf', async (_event, html: string, defaultName: string) => {
    let pdfWindow: BrowserWindow | null = null
    try {
      pdfWindow = new BrowserWindow({ width: 800, height: 600, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await new Promise(r => setTimeout(r, 1500))
      const pdfBuffer = await pdfWindow.webContents.printToPDF({})
      pdfWindow.close(); pdfWindow = null
      return { success: true, dataUrl: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`, defaultName }
    } catch (error: any) { if (pdfWindow) pdfWindow.close(); return { success: false, error: error.message } }
  })

  ipcMain.handle('pdf:generateToFile', async (_event, html: string, fileName: string) => {
    let pdfWindow: BrowserWindow | null = null
    try {
      pdfWindow = new BrowserWindow({ width: 800, height: 600, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await new Promise(r => setTimeout(r, 1500))
      const pdfBuffer = await pdfWindow.webContents.printToPDF({})
      pdfWindow.close(); pdfWindow = null
      const filePath = path.join(app.getPath('temp'), fileName.replace(/[^a-zA-Z0-9_.-]/g, '_'))
      fs.writeFileSync(filePath, pdfBuffer)
      return { success: true, filePath }
    } catch (error: any) { if (pdfWindow) pdfWindow.close(); return { success: false, error: error.message } }
  })

  // Clipboard
  ipcMain.handle('clipboard:copyFile', async (_event, filePath: string) => {
    try {
      const normalizedPath = path.resolve(filePath)
      const script = `Add-Type -AssemblyName System.Windows.Forms; $paths = New-Object System.Collections.Specialized.StringCollection; $paths.Add('${normalizedPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}'); [System.Windows.Forms.Clipboard]::SetFileDropList($paths)`
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      return await new Promise((resolve) => {
        exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 10000 }, (err, _stdout, stderr) => {
          resolve(err ? { success: false, error: stderr || err.message } : { success: true })
        })
      })
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // Bluetooth scan
  ipcMain.handle('scan:bluetooth', async () => {
    try {
      const devices: any[] = []
      const isWin = process.platform === 'win32'
      const addDevice = (device: any) => {
        const name = String(device.name || '').trim()
        if (!name) return
        const key = `${name.toLowerCase()}|${String(device.address || device.deviceId || '').toLowerCase()}`
        const existing = devices.find((d: any) => `${d.name.toLowerCase()}|${String(d.address || d.deviceId || '').toLowerCase()}` === key)
        if (existing) Object.assign(existing, { ...device, name })
        else devices.push({ name, address: device.address || '', deviceId: device.deviceId || device.address || '', model: device.model || 'Bluetooth', source: device.source || 'bluetooth', portName: device.portName || '' })
      }
      const parseJsonList = (value: string): any[] => { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : [parsed] } catch { return [] } }
      const runPowerShellJson = (script: string) => new Promise<string>((resolve) => {
        const encoded = Buffer.from(script, 'utf16le').toString('base64')
        exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 10000 }, (err, stdout) => { resolve(err ? '[]' : stdout || '[]') })
      })

      if (isWin) {
        for (const d of parseJsonList(await runPowerShellJson(`Get-PnpDevice -Class Bluetooth | Where-Object { $_.Status -eq 'OK' -and $_.FriendlyName } | Select-Object FriendlyName, DeviceID | ConvertTo-Json -Compress`))) {
          addDevice({ name: d.FriendlyName, address: d.DeviceID || '', deviceId: d.DeviceID || '', model: 'Bluetooth', source: 'bluetooth' })
        }
        for (const p of parseJsonList(await runPowerShellJson(`Get-CimInstance Win32_Printer | Where-Object { $_.Name -match 'bluetooth|bt|label|zebra|tsc|xprinter|xp-|rongta|goojprt|munbyn|hprt|portable|thermal|termica|etiqueta' -or $_.DriverName -match 'bluetooth|bt|label|zebra|tsc|xprinter|xp-|rongta|goojprt|munbyn|hprt|portable|thermal|termica|etiqueta' -or $_.PortName -match 'BTH|Bluetooth|COM' } | Select-Object Name, DriverName, PortName, DeviceID | ConvertTo-Json -Compress`))) {
          addDevice({ name: p.Name, address: p.PortName || p.DeviceID || '', deviceId: p.Name || p.DeviceID || '', model: p.DriverName || 'Bluetooth Printer', source: 'bluetooth-printer' })
        }
        for (const port of parseJsonList(await runPowerShellJson(`Get-PnpDevice -Class Ports | Where-Object { $_.Status -eq 'OK' -and $_.FriendlyName -match 'COM\\d+' } | Select-Object FriendlyName, InstanceId | ConvertTo-Json -Compress`)).map((port: any) => {
          const portName = String(port.FriendlyName || '').match(/COM\d+/i)?.[0]?.toUpperCase() || ''
          const instanceId = String(port.InstanceId || '')
          const address = instanceId.match(/([0-9A-F]{12})/i)?.[1] || ''
          return { portName, instanceId, address }
        }).filter((port: any) => port.portName)) {
          const matched = devices.find((device: any) => {
            const deviceAddress = String(device.deviceId || device.address || '').match(/DEV_([0-9A-F]{12})/i)?.[1] || ''
            return deviceAddress && port.instanceId.toUpperCase().includes(deviceAddress.toUpperCase())
          })
          if (matched) {
            matched.portName = port.portName
            if (matched.source === 'bluetooth') { matched.source = 'bluetooth-direct'; matched.model = `Bluetooth directo ${port.portName}` }
          } else addDevice({ name: `Bluetooth ${port.portName}`, address: port.address, deviceId: port.instanceId, model: `Bluetooth directo ${port.portName}`, source: 'bluetooth-direct', portName: port.portName })
        }
      }
      return { success: true, data: devices }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // Actualizacion
  ipcMain.handle('app:getName', () => app.getName())
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:getConfig', () => {
    try {
      const basePath = path.dirname(app.getPath('exe'))
      for (const p of [path.join(basePath, 'config.json'), path.join(process.cwd(), 'config.json'), path.join(__dirname, 'config.json')]) {
        try { if (fs.existsSync(p)) return { success: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) } } catch {}
      }
      return { success: false, error: 'config.json no encontrado' }
    } catch { return { success: false, error: 'Error al leer config' } }
  })

  ipcMain.handle('update:check', async () => {
    try {
      const res = await fetch('https://celulares.tmposystem.com/api2/actualizaciones', {
        headers: { 'Accept': '*/*', 'Authorization': bcrypt.hashSync('1234567890abc', 10) },
      })
      if (!res.ok) return { success: false, error: `Respuesta ${res.status} del servidor de actualizaciones` }
      const text = await res.text()
      let data; try { data = JSON.parse(text) } catch { return { success: false, error: 'Respuesta invalida: ' + text.slice(0, 100) } }
      return { success: true, data }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('update:download', async (_event, url_: string) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, { title: 'Guardar e instalar actualizacion', defaultPath: path.join(app.getPath('downloads'), 'ArgentPOS-Setup.exe'), filters: [{ name: 'Instalador', extensions: ['exe', 'msi'] }] })
      if (result.canceled || !result.filePath) return { success: false, error: 'Descarga cancelada' }
      const res = await fetch(url_)
      if (!res.ok) return { success: false, error: 'Error al descargar' }
      fs.writeFileSync(result.filePath, Buffer.from(await res.arrayBuffer()))
      return { success: true, path: result.filePath }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('update:downloadAuto', async (_event, url_: string) => {
    try {
      const res = await fetch(url_)
      if (!res.ok) return { success: false, error: 'Error al descargar' }
      fs.writeFileSync(path.join(app.getPath('downloads'), 'ArgentPOS-Setup.exe'), Buffer.from(await res.arrayBuffer()))
      return { success: true, path: path.join(app.getPath('downloads'), 'ArgentPOS-Setup.exe') }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('update:install', async (_event, filePath: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase()
      const args = ext === '.msi' ? ['/quiet', '/norestart'] : ['/S']
      const currentExe = process.execPath
      spawn(filePath, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
      setTimeout(() => { try { spawn(currentExe, [], { detached: true, stdio: 'ignore', windowsHide: true }).unref() } catch {}; app.quit() }, 5000)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('open:devtools', () => { try { mainWindow?.webContents.openDevTools(); return { success: true } } catch (error: any) { return { success: false, error: error.message } } })

  // Guardar PDF
  ipcMain.handle('save:pdf', async (_event, dataUrl: string, defaultName: string) => {
    try {
      const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
      const result = await dialog.showSaveDialog({ title: 'Guardar PDF', defaultPath: defaultName, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
      if (result.canceled || !result.filePath) return { success: false }
      await fs.promises.writeFile(result.filePath, buffer)
      return { success: true, path: result.filePath }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // Backup
  ipcMain.handle('backup:create', async () => {
    try {
      const backupsDir = getBackupsDir()
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `backup_${stamp}.db`
      const filePath = path.join(backupsDir, fileName)
      await db!.backup(filePath)
      await pruneBackups(5)
      return { success: true, data: { fileName } }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('backup:list', async () => {
    try {
      const backupsDir = getBackupsDir()
      const files = await fs.promises.readdir(backupsDir)
      const backups = await Promise.all(files.filter(f => f.toLowerCase().endsWith('.db')).map(async file => {
        const stat = await fs.promises.stat(path.join(backupsDir, file))
        return { nombre: file, tamano: stat.size, fecha: stat.mtime.toISOString() }
      }))
      backups.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      return { success: true, data: backups }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('backup:download', async (_event, fileName: string) => {
    try {
      const source = path.join(getBackupsDir(), path.basename(fileName))
      await fs.promises.access(source)
      const result = await dialog.showSaveDialog({ title: 'Guardar backup', defaultPath: path.basename(fileName), filters: [{ name: 'SQLite Backup', extensions: ['db'] }] })
      if (result.canceled || !result.filePath) return { success: false }
      await fs.promises.copyFile(source, result.filePath)
      return { success: true, path: result.filePath }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('backup:delete', async (_event, fileName: string) => {
    try {
      await fs.promises.unlink(path.join(getBackupsDir(), path.basename(fileName)))
      return { success: true }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('backup:restore', async (_event, fileName: string) => {
    try {
      const backupPath = path.join(getBackupsDir(), path.basename(fileName))
      const dbPath = getDbPath()
      await fs.promises.access(backupPath)
      if (db) { db.close(); db = null }
      await fs.promises.copyFile(backupPath, dbPath)
      initDatabase()
      return { success: true }
    } catch (error: any) {
      if (!db) initDatabase()
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('getServerUrl', () => { return { success: true, url: serverUrl } })

  // consultaservidor
  ipcMain.handle('consultaservidor', (_event, action: string, ...args: any[]) => {
    try {
      if (action === 'getAllConfig') {
        return { VITE_LINKURL: process.env.VITE_LINKURL || 'http://localhost:3000', VITE_LINK_API: process.env.VITE_LINK_API || 'http://localhost:3000/api', VITE_TOKEN: process.env.VITE_TOKEN || '', VITE_PATRON_TELEFONO: process.env.VITE_PATRON_TELEFONO || '^[0-9]{10}$', VITE_IMPRESORA_LOCAL: process.env.VITE_IMPRESORA_LOCAL || '', VITE_PATRON_CEDULA: process.env.VITE_PATRON_CEDULA || '^[0-9]{11}$', VITE_TOKEN_CORTO: process.env.VITE_TOKEN_CORTO || '' }
      }
      if (action === 'tableExists') {
        const result = db!.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(args[0])
        return result ? ['ok'] : ['error']
      }
      if (action === 'getTableColumns') {
        const columns = db!.prepare(`PRAGMA table_info("${args[0]}")`).all()
        return args[1] === 'names' ? columns.map((c: any) => c.name) : columns
      }
      if (action === 'crearTabla') {
        const campos = Array.isArray(args[1]) ? args[1].join(', ') : args[1]
        db!.exec(`CREATE TABLE IF NOT EXISTS "${args[0]}" (${campos})`)
        return { success: true }
      }
      if (action === 'addColumnToTable') {
        try { db!.exec(`ALTER TABLE "${args[0]}" ADD COLUMN "${args[1]}"`); return ['ok'] } catch (error: any) { return { success: false, error: error.message } }
      }
      if (action === 'getAllTables') {
        const rows = db!.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all()
        return { data: rows.map((r: any) => r.name) }
      }
      if (action === 'rawQuery') {
        try { db!.exec(args[0]); return { success: true } } catch (error: any) { return { success: false, error: error.message } }
      }
      if (action === 'executeSQL') {
        const sql = args[0].trim()
        try {
          const upper = sql.toUpperCase()
          if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('EXPLAIN')) {
            const rows = db!.prepare(sql).all() as Record<string, any>[]
            const columns = rows.length > 0 ? Object.keys(rows[0]) : []
            return { success: true, type: 'select', rows: rows.map((r: any, i: number) => ({ ...r, __index: i })), columns, count: rows.length }
          } else {
            const result = db!.prepare(sql).run()
            return { success: true, type: 'execute', changes: result.changes }
          }
        } catch (error: any) { return { success: false, error: error.message } }
      }
      if (action === 'vaciarTabla') {
        try { db!.exec(`DELETE FROM "${args[0]}"`); db!.exec(`DELETE FROM sqlite_sequence WHERE name='${args[0]}'`); return { success: true } } catch (error: any) { return { success: false, error: error.message } }
      }
      if (action === 'eliminarTabla') {
        try { db!.exec(`DROP TABLE IF EXISTS "${args[0]}"`); return { success: true } } catch (error: any) { return { success: false, error: error.message } }
      }
      if (action === 'getCreateTableSQL') {
        const row = db!.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(args[0]) as any
        return { success: true, sql: row?.sql || '' }
      }
      if (action === 'getTableRowCount') {
        const row = db!.prepare(`SELECT COUNT(*) as count FROM "${args[0]}"`).get() as any
        return { success: true, count: row?.count || 0 }
      }
      return null
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // Email
  function decodeBase64Password(encoded: string): string {
    if (!encoded) return ''
    try {
      const base64Regex = /^[A-Za-z0-9+/]+=*$/
      if (!base64Regex.test(encoded)) return encoded
      const decoded = Buffer.from(encoded, 'base64').toString('utf8')
      return Buffer.from(decoded, 'utf8').toString('base64') === encoded ? decoded : encoded
    } catch { return encoded }
  }

  function getOtpEmailConfig() {
    return {
      activo: 1,
      email: 'tmposrd@gmail.com',
      password: decodeBase64Password('bHRra2lleHJ0Y2hzcG5ycA=='),
      host: 'smtp.gmail.com',
      puerto: 587,
      seguridad: 'STARTTLS',
    }
  }

  function getEmailConfig() {
    const defaultEmailConfig = getOtpEmailConfig()
    const row = db!.prepare(`SELECT * FROM correo WHERE id = 1`).get() as any
    if (!row) return defaultEmailConfig
    const email = row.email || defaultEmailConfig.email
    const password = row.password ? decodeBase64Password(row.password || '') : defaultEmailConfig.password
    return {
      activo: Number(row.activo ?? defaultEmailConfig.activo),
      email,
      password,
      host: row.host || row.smtp_host || defaultEmailConfig.host,
      puerto: Number(row.puerto || row.port || defaultEmailConfig.puerto),
      seguridad: row.seguridad || row.secure || defaultEmailConfig.seguridad,
    }
  }

  function smtpCommand(socket: any, command: string | null, expected: number[] = [250]): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = ''
      const cleanup = () => { socket.off('data', onData); socket.off('error', onError) }
      const onError = (error: Error) => { cleanup(); reject(error) }
      const onData = (data: Buffer) => {
        buffer += data.toString('utf8')
        const lines = buffer.split(/\r?\n/).filter(Boolean)
        if (lines.length === 0) return
        const last = lines[lines.length - 1]
        if (!/^\d{3}\s/.test(last)) return
        cleanup()
        if (expected.includes(Number(last.slice(0, 3)))) resolve(buffer)
        else reject(new Error(`SMTP ${last.slice(0, 3)}: ${buffer.trim()}`))
      }
      socket.on('data', onData); socket.on('error', onError)
      if (command) socket.write(`${command}\r\n`)
    })
  }

  function connectSmtp(host: string, port: number, secure: boolean): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: any = { host, port, servername: host }
      const socket = secure ? tls.connect(options) : net.connect(options)
      socket.setTimeout(30000)
      socket.once('error', reject)
      socket.once(secure ? 'secureConnect' : 'connect', () => resolve(socket))
      socket.once('timeout', () => { socket.destroy(); reject(new Error('Tiempo de espera agotado')) })
    })
  }

  async function sendEmail(toEmail: string, subject: string, html: string, host: string, port: number, secure: boolean, authConfig?: any): Promise<any> {
    const config = authConfig || getEmailConfig()
    let socket = await connectSmtp(host, port, secure)
    try {
      await smtpCommand(socket, null, [220])
      await smtpCommand(socket, `EHLO ${hostname() || 'localhost'}`)
      if (!secure) {
        await smtpCommand(socket, 'STARTTLS', [220])
        socket = tls.connect({ socket, servername: host })
        await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject) })
        await smtpCommand(socket, `EHLO ${hostname() || 'localhost'}`)
      }
      await smtpCommand(socket, 'AUTH LOGIN', [334])
      await smtpCommand(socket, Buffer.from(config.email).toString('base64'), [334])
      await smtpCommand(socket, Buffer.from(config.password).toString('base64'), [235])
      await smtpCommand(socket, `MAIL FROM:<${config.email}>`)
      await smtpCommand(socket, `RCPT TO:<${toEmail}>`, [250, 251])
      await smtpCommand(socket, 'DATA', [354])
      const message = `From: "${config.email}" <${config.email}>\r\nTo: <${toEmail}>\r\nSubject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${html}`
      await smtpCommand(socket, `${message}\r\n.`, [250])
      await smtpCommand(socket, 'QUIT', [221])
      return { success: true }
    } finally { socket.end() }
  }

  async function sendTestEmail(toEmail: string, host: string, port: number, secure: boolean): Promise<any> {
    return sendEmail(
      toEmail,
      'Prueba de configuracion de correo',
      '<h2>Correo de prueba</h2><p>Si recibes este mensaje, la configuracion de correo funciona correctamente.</p>',
      host,
      port,
      secure
    )
  }

  ipcMain.handle('enviar:testEmail', async (_event, toEmail: string) => {
    try {
      const config = getEmailConfig()
      if (!config.activo) return { success: false, error: 'Correo desactivado en configuracion' }
      if (!config.email || !config.password) return { success: false, error: 'Configuracion de correo incompleta' }
      if (!toEmail || !toEmail.includes('@')) return { success: false, error: 'Correo destinatario invalido' }
      let lastError: any = null
      for (const attempt of [{ port: 587, secure: false, label: '587 STARTTLS' }, { port: 465, secure: true, label: '465 SSL' }]) {
        try { await sendTestEmail(toEmail, 'smtp.gmail.com', attempt.port, attempt.secure); return { success: true, message: `Correo de prueba enviado correctamente (puerto ${attempt.label})` } } catch (e: any) { lastError = e }
      }
      return { success: false, error: `No se pudo enviar el correo. Intentos fallidos: ${lastError?.message || 'Error desconocido'}` }
    } catch (e: any) { return { success: false, error: e.message || 'Error al enviar correo' } }
  })

  ipcMain.handle('enviar:otp', async (_event, toEmail: string, codigo: string) => {
    try {
      const config = getEmailConfig()
      if (!config.activo) return { success: false, error: 'Correo desactivado en configuracion' }
      if (!config.email || !config.password) return { success: false, error: 'Configuracion de correo incompleta' }
      if (!toEmail || !toEmail.includes('@')) return { success: false, error: 'Correo destinatario invalido' }
      let lastError: any = null
      for (const attempt of [{ port: 587, secure: false, label: '587 STARTTLS' }, { port: 465, secure: true, label: '465 SSL' }]) {
        try {
          await sendEmail(toEmail, 'Codigo de verificacion - TMPOS', `<h2>Tu codigo de verificacion</h2><p style="font-size:24px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f3f4f6;border-radius:8px">${codigo}</p><p>Este codigo expirara en 10 minutos.</p>`, 'smtp.gmail.com', attempt.port, attempt.secure)
          return { success: true, message: `OTP enviado (puerto ${attempt.label})` }
        } catch (e: any) { lastError = e }
      }
      return { success: false, error: `No se pudo enviar el OTP. Intentos fallidos: ${lastError?.message || 'Error desconocido'}` }
    } catch (e: any) { return { success: false, error: e.message || 'Error al enviar OTP' } }
  })

  ipcMain.handle('enviar:cierreCaja', async (_event, payload: any) => {
    try {
      // Los reportes de cierre usan el mismo SMTP confiable que los OTP.
      const config = getOtpEmailConfig()
      if (!config.email || !config.password) return { success: false, error: 'Configuracion de correo incompleta' }

      const toEmail = getEmailEmpresa()
      if (!toEmail || !toEmail.includes('@')) {
        return { success: false, error: 'Configura un correo valido en los datos de la empresa' }
      }
      if (!payload?.html) return { success: false, error: 'El reporte de cierre esta vacio' }

      const attempts = [
        { host: config.host || 'smtp.gmail.com', port: Number(config.puerto || 587), secure: false },
        { host: 'smtp.gmail.com', port: 465, secure: true },
      ]

      let lastError: any = null
      for (const attempt of attempts) {
        try {
          await sendEmail(
            toEmail,
            String(payload.subject || 'Cierre de caja'),
            String(payload.html),
            attempt.host,
            attempt.port,
            attempt.secure,
            config
          )
          return { success: true, message: `Cierre enviado a ${toEmail}`, toEmail }
        } catch (e: any) {
          lastError = e
        }
      }
      return { success: false, error: `No se pudo enviar el cierre: ${lastError?.message || 'Error desconocido'}` }
    } catch (e: any) {
      return { success: false, error: e.message || 'Error al enviar el cierre de caja' }
    }
  })
}

let serverUrl = ''

function findFreePort(startPort = 5173): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(findFreePort(startPort + 1)))
    server.listen(startPort, '0.0.0.0', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : startPort
      server.close(() => resolve(port))
    })
  })
}

function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/octet-stream',
}

async function startLocalServer() {
  try {
    const port = await findFreePort()
    const distDir = path.join(__dirname, '../dist')
    if (!fs.existsSync(distDir)) { console.warn('[Server] dist/ no encontrado, servidor no iniciado'); return }

    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

      const urlPath = req.url || '/'
      if (urlPath.startsWith('/api/') && req.method === 'POST') {
        const buffers: Buffer[] = []
        for await (const chunk of req) buffers.push(chunk)
        const body = JSON.parse(Buffer.concat(buffers).toString('utf-8') || '{}')
        try {
          const action = urlPath.replace('/api/', '')
          let result: any
          if (action === 'db/getAll') { const rows = db!.prepare(`SELECT * FROM "${body.tabla}" ORDER BY id DESC`).all(); result = { success: true, data: rows } }
          else if (action === 'db/getModified') {
            const rows = body.desde
              ? db!.prepare(`SELECT * FROM "${body.tabla}" WHERE updated_at > ? ORDER BY updated_at ASC`).all(body.desde)
              : db!.prepare(`SELECT * FROM "${body.tabla}" ORDER BY id DESC`).all()
            result = { success: true, data: rows }
          }
          else if (action === 'db/getById') { const row = db!.prepare(`SELECT * FROM "${body.tabla}" WHERE id = ?`).get(body.id); result = { success: true, data: row } }
          else if (action === 'db/insert') {
            if (!body.data.uid) body.data.uid = generarUid()
            body.data.created_at = new Date().toISOString(); body.data.updated_at = new Date().toISOString()
            const keys = Object.keys(body.data); const placeholders = keys.map(() => '?').join(', ')
            const r = db!.prepare(`INSERT INTO "${body.tabla}" (${keys.join(', ')}) VALUES (${placeholders})`).run(...Object.values(body.data))
            const newId = Number(r.lastInsertRowid)
            if (body.tabla !== 'bitacora') registrarBitacora(body.tabla, newId, 'CREATE', body.usuario || '', body.data, null)
            result = { success: true, data: { id: newId } }
          } else if (action === 'db/update') {
            const oldData = db!.prepare(`SELECT * FROM "${body.tabla}" WHERE id = ?`).get(body.id) as Record<string, any> || {}
            body.data.updated_at = new Date().toISOString()
            const keys = Object.keys(body.data); const sets = keys.map(k => `"${k}" = ?`).join(', ')
            db!.prepare(`UPDATE "${body.tabla}" SET ${sets} WHERE id = ?`).run(...Object.values(body.data), body.id)
            if (body.tabla !== 'bitacora') registrarBitacora(body.tabla, body.id, 'UPDATE', body.usuario || '', body.data, oldData)
            result = { success: true }
          } else if (action === 'db/delete') {
            const oldData = db!.prepare(`SELECT * FROM "${body.tabla}" WHERE id = ?`).get(body.id) as Record<string, any> || {}
            const uid = oldData?.uid || ''
            db!.prepare(`DELETE FROM "${body.tabla}" WHERE id = ?`).run(body.id)
            if (body.tabla !== 'bitacora' && body.tabla !== 'sync_deletes') {
              registrarBitacora(body.tabla, body.id, 'DELETE', body.usuario || '', null, oldData)
              if (uid) { try { db!.prepare(`INSERT INTO sync_deletes (tabla, uid) VALUES (?, ?)`).run(body.tabla, uid) } catch {} }
            }
            result = { success: true }
          } else if (action === 'db/bitacoraList') { const rows = db!.prepare(`SELECT * FROM bitacora ORDER BY id DESC LIMIT ?`).all(body.limite || 1000); result = { success: true, data: rows } }
          else if (action === 'db/bitacoraDeleteAll') { db!.prepare(`DELETE FROM bitacora`).run(); result = { success: true } }
          else if (action === 'datosarchivo') result = {}
          else result = { success: false, error: `Accion desconocida: ${action}` }
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result))
        } catch (error: any) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: error.message })) }
        return
      }

      let filePath = path.join(distDir, urlPath === '/' ? '/index.html' : urlPath)
      let ext = path.extname(filePath).toLowerCase()
      if (ext && MIME_TYPES[ext]) {
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] }); res.end(fs.readFileSync(filePath))
      } else {
        const indexPath = path.join(distDir, 'index.html')
        if (!fs.existsSync(indexPath)) { res.writeHead(404); res.end('Not Found'); return }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(indexPath, 'utf-8'))
      }
    })

    await new Promise<void>((resolve, reject) => {
      server.listen(port, '0.0.0.0', () => { serverUrl = `http://${getLocalIP()}:${port}`; resolve() })
      server.on('error', reject)
    })
  } catch (error) { console.error('[Server] Error al iniciar servidor:', error) }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600, show: false,
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false },
    titleBarStyle: 'default',
  })
  mainWindow.on('ready-to-show', () => { mainWindow?.maximize(); mainWindow?.show() })
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(join(__dirname, '../dist/index.html'))
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  initDatabase()
  setupIpcHandlers()
  await startLocalServer()
  createWindow()
  mainWindow?.webContents.closeDevTools()
  mainWindow?.webContents.on('before-input-event', (_event, input) => { if (input.key === 'F12') mainWindow?.webContents.toggleDevTools() })
})

app.on('window-all-closed', () => {
  if (db) { db.close(); db = null }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
