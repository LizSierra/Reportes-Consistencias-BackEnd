const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./miproyecto.db', (err) => {
  if (err) {
    console.error('Error al abrir DB:', err.message);
  } else {
    db.run('PRAGMA journal_mode = WAL');
    console.log('Conectado a la base de datos miproyecto.db con modo WAL');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS combinaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modelo_id TEXT,
  datos TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
});

module.exports = db;
