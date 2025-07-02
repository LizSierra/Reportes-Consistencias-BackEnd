// combinacionesController.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mi_base_de_datos.db'); // Ajusta ruta

/**
 * Genera todas las combinaciones recursivamente
 */
function generarTodasLasCombinaciones(variables, index = 0, current = {}, result = [], limite = 1000) {
  if (index === variables.length) {
    result.push({ ...current });
    return;
  }

  const variable = variables[index];
  const { nombre, tipo, total, decimales } = variable;

  // Genera valores según tipo
  let valores = [];
  switch (tipo.toLowerCase()) {
    case 'varchar2':
    case 'char':
      // Para char y varchar2, genera cadenas 'A', 'B', ... limitado a total
      const longitud = total || 1;
      const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < Math.min(longitud, letras.length); i++) {
        valores.push(letras[i]);
      }
      break;

    case 'number':
      const max = total || 3;
      const dec = decimales || 0;
      const maxNum = Math.pow(10, max) - 1;
      const incremento = dec > 0 ? 1 / Math.pow(10, dec) : 1;
      // Limitar máximo valores para evitar exceso
      for (let n = 0; n <= maxNum && valores.length < 10; n++) {
        valores.push(parseFloat(n * incremento).toFixed(dec));
      }
      break;

    case 'boolean':
      valores = [true, false];
      break;

    case 'date':
      // Fechas fijas para ejemplo
      valores = ['2025-01-01', '2025-06-01', '2025-12-31'];
      break;

    default:
      valores = ['N/A'];
  }

  for (const val of valores) {
    if (result.length >= limite) break;
    current[nombre] = val;
    generarTodasLasCombinaciones(variables, index + 1, current, result, limite);
  }

  return result;
}

/**
 * Evalúa vectores teóricos con reglas condicionales
 * vectores = [{ nombre: "X1", reglas: [ { condiciones: [{variable, operador, valor}], asignacion: valorAsignado } ] }]
 */
function evaluarVectores(combinacion, vectores) {
  const resultado = {};
  for (const vector of vectores) {
    try {
      let valorAsignado = null;
      for (const regla of vector.reglas) {
        const cumpleTodas = regla.condiciones.every(cond => {
          const valVariable = combinacion[cond.variable];
          const valCond = cond.valor;

          // Normalizar valores para comparación si es string/número
          if (typeof valVariable === 'string' && !isNaN(valVariable)) {
            // Convertir string numérica a número para comparar
            return compararNumeros(parseFloat(valVariable), cond.operador, valCond);
          }

          return comparar(valVariable, cond.operador, valCond);
        });
        if (cumpleTodas) {
          valorAsignado = regla.asignacion;
          break;
        }
      }
      resultado[vector.nombre] = valorAsignado;
    } catch {
      resultado[vector.nombre] = null;
    }
  }
  return resultado;
}

function comparar(a, operador, b) {
  switch (operador) {
    case '=': return a == b;
    case '!=': return a != b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    default: return false;
  }
}

function compararNumeros(a, operador, b) {
  // a y b pueden ser números o strings numéricos
  const numB = parseFloat(b);
  return comparar(a, operador, numB);
}

/**
 * Evalúa función direccionamiento dinámica en contexto de fila
 * formula ejemplo: '3 * X1 + X2 + 1'
 */
function evaluarFuncionDireccionamiento(fila, formula) {
  try {
    const fn = new Function('fila', `with(fila) { return ${formula}; }`);
    return fn(fila);
  } catch (e) {
    console.error('Error evaluando fórmula direccionamiento:', e.message);
    return null;
  }
}

/**
 * Función simulada para eliminar combinaciones previas en BD
 */
function eliminarCombinacionesExistentes(modeloId) {
  return new Promise((resolve, reject) => {
    // Ajusta la tabla y campos segun tu DB
    const sql = `DELETE FROM combinaciones WHERE modeloId = ?`;
    db.run(sql, [modeloId], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

/**
 * Función simulada para guardar todas las combinaciones en BD
 */
function guardarTodasLasCombinacionesEnBD(modeloId, combinaciones) {
  return new Promise((resolve, reject) => {
    if (!combinaciones.length) return resolve();

    const placeholders = '(?, ?, ?, ?)';
    // Ajusta tabla y campos segun tu esquema
    const sql = `INSERT INTO combinaciones(modeloId, combinacionJson, datos, createdAt) VALUES (?, ?, ?, datetime('now'))`;

    const stmt = db.prepare(sql);

    try {
      for (const fila of combinaciones) {
        const filaJson = JSON.stringify(fila);
        stmt.run(modeloId, filaJson, fila.F);
      }
      stmt.finalize();
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Endpoint principal para generar combinaciones
 */
exports.generarCombinaciones = async (req, res) => {
  try {
    const { variables, vectores = [], funcionDireccionamiento, modeloId = null } = req.body;

    if (!variables || !Array.isArray(variables)) {
      return res.status(400).json({ error: 'Variables inválidas o faltantes' });
    }

    const LIMITE = 1000;
    const combinaciones = generarTodasLasCombinaciones(variables, 0, {}, [], LIMITE);

    if (modeloId) {
      await eliminarCombinacionesExistentes(modeloId);
    }

    // Primero evaluamos vectores teóricos y función direccionamiento
    let resultadoFinal = combinaciones.map(c => {
      const vectoresEvaluados = evaluarVectores(c, vectores);
      const fila = { ...c, ...vectoresEvaluados };
      fila['F'] = funcionDireccionamiento ? evaluarFuncionDireccionamiento(fila, funcionDireccionamiento) : null;
      return fila;
    });

    // Luego aplicamos variables generadas (SUMA, RESTA, etc)
    resultadoFinal = aplicarVariablesGeneradas(resultadoFinal, variables);

    if (modeloId) {
      await guardarTodasLasCombinacionesEnBD(modeloId, resultadoFinal);
    }

    res.json({ combinaciones: resultadoFinal });
  } catch (e) {
    console.error('Error en generarCombinaciones:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};



function aplicarVariablesGeneradas(combinaciones, variables) {
  const generadas = variables.filter(v => v.variablegenerada === 'SI');

  return combinaciones.map(comb => {
    const nuevaComb = { ...comb };

    for (const variable of generadas) {
      const { nombre, tipo, valor } = variable;

      if (!Array.isArray(valor)) continue;

      const operandos = valor.map(varName => {
        const num = parseFloat(comb[varName]);
        return isNaN(num) ? 0 : num;
      });

      let resultado = null;

      switch (tipo) {
        case 'SUMA':
          resultado = operandos.reduce((a, b) => a + b, 0);
          break;
        case 'RESTA':
          resultado = operandos.reduce((a, b) => a - b);
          break;
        case 'MULTIPLICA':
          resultado = operandos.reduce((a, b) => a * b, 1);
          break;
        case 'EXTRAE_MAX':
          resultado = Math.max(...operandos);
          break;
        default:
          resultado = null;
      }

      nuevaComb[nombre] = resultado;
    }

    return nuevaComb;
  });
}
