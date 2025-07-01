const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Conexión a SQLite
const db = new sqlite3.Database('./miproyecto.db');

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  email TEXT
)`);

// GET usuarios
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT * FROM usuarios', [], (err, rows) => {
    if (err) {
      console.error('❌ Error al consultar usuarios:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});


// POST usuarios
app.post('/api/usuarios', (req, res) => {
  const { nombre, email } = req.body;
  console.log('Datos recibidos para insertar:', nombre, email);

  db.run(
    'INSERT INTO usuarios (nombre, email) VALUES (?, ?)',
    [nombre, email],
    function (err) {
      if (err) {
        console.error('❌ Error al insertar en la BD:', err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log('✅ Usuario insertado con ID:', this.lastID);
      res.json({ id: this.lastID });
    }
  );
});


// Arrancar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
