import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { getDataDir } from '../../shared/paths.js'

class AppDatabase {
  constructor() {
    this.db = null
  }

  init() {
    const dir = getDataDir()
    fs.mkdirSync(dir, { recursive: true })
    this.db = new Database(path.join(dir, 'xfoto.db'))
    this._migrate()
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id          TEXT PRIMARY KEY,
        state       TEXT NOT NULL,
        template_id TEXT,
        photo_paths TEXT,
        final_path  TEXT,
        created_at  INTEGER DEFAULT (strftime('%s','now')),
        updated_at  INTEGER DEFAULT (strftime('%s','now'))
      )
    `)
  }

  createOrder(id, templateId) {
    this.db.prepare(
      `INSERT INTO orders (id, state, template_id) VALUES (?, 'CREATED', ?)`
    ).run(id, templateId)
  }

  updateOrder(id, fields) {
    const entries = Object.entries(fields)
    const set = entries.map(([k]) => `${k} = ?`).join(', ')
    const vals = entries.map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : v))
    this.db.prepare(
      `UPDATE orders SET ${set}, updated_at = strftime('%s','now') WHERE id = ?`
    ).run(...vals, id)
  }

  getOrder(id) {
    return this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  }
}

export default new AppDatabase()
