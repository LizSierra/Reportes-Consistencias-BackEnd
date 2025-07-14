const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Ruta absoluta para evitar confusiones
const DB_PATH = path.resolve(__dirname, "miproyecto.db");

const db = new sqlite3.Database(
  DB_PATH,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error("Error al abrir DB:", err.message);
    } else {
      db.run("PRAGMA journal_mode = WAL", (pragmaErr) => {
        if (pragmaErr) {
          console.error("Error al establecer modo WAL:", pragmaErr.message);
        } else {
          console.log(
            "Conectado a la base de datos miproyecto.db con modo WAL"
          );
        }
      });
    }
  }
);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS combinaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modeloId TEXT NOT NULL,
    combinacionJson TEXT NOT NULL,
    datos TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  )`,
    (err) => {
      if (err) {
        console.error("Error creando tabla combinaciones:", err.message);
      } else {
        console.log("Tabla combinaciones lista.");
      }
    }
  );
});

module.exports = db;
