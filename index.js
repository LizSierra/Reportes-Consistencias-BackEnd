const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const combinacionesController = require('./utils/combinacionesController.js');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/modelos', (req, res) => {
  db.all('SELECT * FROM modelos', [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener modelos' });
    }
    const modelos = rows.map(row => ({
      id: row.id,
      nombre: row.nombre,
      variables: JSON.parse(row.variables)
    }));
    res.json(modelos);
  });
});

app.post('/api/modelos', (req, res) => {
  const { nombre, variables } = req.body;
  if (!nombre || !variables) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const id = uuidv4();
  const variablesJSON = JSON.stringify(variables);

  db.run('INSERT INTO modelos (id, nombre, variables) VALUES (?, ?, ?)', [id, nombre, variablesJSON], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al guardar modelo' });
    }
    res.json({ id, nombre, variables });
  });
});

app.put('/api/modelos/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, variables } = req.body;

  if (!nombre || !variables) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const variablesJSON = JSON.stringify(variables);

  db.run(
    'UPDATE modelos SET nombre = ?, variables = ? WHERE id = ?',
    [nombre, variablesJSON, id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al actualizar modelo' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Modelo no encontrado' });
      }
      res.json({ id, nombre, variables });
    }
  );
});

// NUEVO: endpoint que genera combinaciones y calcula vectores
app.post('/api/combinaciones', combinacionesController.generarCombinaciones);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
