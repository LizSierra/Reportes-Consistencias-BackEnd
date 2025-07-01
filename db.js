// app.js
const sqlite3 = require('sqlite3').verbose();

// Abre la base
const db = new sqlite3.Database('./miproyecto.db');

// Ejecuta una consulta
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS productos (id INTEGER PRIMARY KEY, nombre TEXT)");
  db.run("INSERT INTO productos (nombre) VALUES (?)", ['Ejemplo']);
  db.each("SELECT id, nombre FROM productos", (err, row) => {
    console.log(`${row.id}: ${row.nombre}`);
    console.log('Conectado a:', __dirname + '/miproyecto.db');
  });
});

db.close();
