import express from 'express';
import { evaluarVectoresYFuncion } from '../utils/evaluador';

const router = express.Router();

router.post('/evaluar-direccionamiento', (req, res) => {
  const { combinaciones, modelo } = req.body;

  if (!combinaciones || !modelo) {
    return res.status(400).json({ error: 'Faltan datos necesarios.' });
  }

  try {
    const resultado = evaluarVectoresYFuncion(combinaciones, modelo);
    res.json({ combinaciones: resultado });
  } catch (error) {
    res.status(500).json({ error: 'Error al evaluar combinaciones.' });
  }
});

export default router;
