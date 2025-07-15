const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./miproyecto.db");

const LIMITE = 1000;

function generarValoresClaveNumero(total) {
  const max = Number("9".repeat(total)); // Ej: 999 para total=3
  const maxExcedido = Number("9".repeat(total + 1)); // Ej: 9999 para total=3
  return [0, max, maxExcedido]; // 🚫 Aquí NO se incluye el 1
}

function generarCombinacionesAleatorias(variables, limite = 1000) {
  const valoresPorVariable = variables.map((variable) => {
    const { tipo, longitud = 1, total = 1, valor, variablegenerada } = variable;

    // Si variable no generada y tiene valor definido
    if (variablegenerada === "NO" && valor) {
      if (typeof valor === "string" && valor.trim() !== "") {
        const valoresLimpios = valor
          .replace(/[()]/g, "") // eliminar paréntesis
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v !== "") // Eliminar entradas vacías
          .map((v) => {
            const limpio = v.trim();
            if (limpio.toUpperCase() === "NULL") return "NULL";
            if (limpio === "") return ""; // explícito, evita el 0
            return isNaN(limpio) ? limpio : Number(limpio);
          });

        if (valoresLimpios.length > 0) return valoresLimpios;
        // Si quedó vacío, seguimos a generación automática abajo
      } else if (Array.isArray(valor)) {
        const valoresLimpios = valor
          .map((v) => {
            if (typeof v === "string") {
              const val = v.trim();
              return val.toUpperCase() === "NULL"
                ? "NULL"
                : isNaN(val)
                ? val
                : Number(val);
            }
            return v;
          })
          .filter((v) => v !== ""); // Evitar vacíos
        if (valoresLimpios.length > 0) return valoresLimpios;
      }
      // Si valor no válido o vacío, se ignora para generar normal
    }

    // Generación automática normal
    switch (tipo.toLowerCase()) {
      case "varchar2":
      case "char":
        return ["NULL", "A".repeat(longitud), "A".repeat(longitud + 1)];
      case "number":
        return generarValoresClaveNumero(total);
      case "boolean":
        return [true, false];
      case "date":
        return ["2025-01-01", "2025-06-01", "2025-12-31"];
      default:
        return ["N/A"];
    }
  });
  const nombres = variables.map((v) => v?.nombre ?? "");
  const todas = [];

  function backtrack(index = 0, actual = {}) {
    if (index === variables.length) {
      todas.push({ ...actual });
      return;
    }

    const valores = valoresPorVariable[index];
    if (!valores || valores.length === 0) {
      // Si no hay valores para esta variable, se pone valor vacío para evitar bloqueo
      actual[nombres[index]] = "";
      backtrack(index + 1, actual);
      return;
    }

    for (const val of valores) {
      actual[nombres[index]] = val;
      backtrack(index + 1, actual);
    }
  }

  backtrack();

  // Mezcla aleatoria
  for (let i = todas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [todas[i], todas[j]] = [todas[j], todas[i]];
  }

  return todas.slice(0, limite);
}

function evaluarVectores(fila, vectores) {
  const resultado = {};
  for (const vector of vectores) {
    let valor = null;
    let reglaOtroCaso = null;

    for (const regla of vector.reglas) {
      // Detectar "Otro caso" por variable especial
      if (
        regla.condiciones.length === 1 &&
        regla.condiciones[0].variable === "__otro__"
      ) {
        reglaOtroCaso = regla;
        continue;
      }

      const cumple = regla.condiciones.every((cond) => {
        const a = fila[cond.variable];
        const b =
          cond.compararContra === "variable"
            ? fila[cond.variableComparada]
            : cond.valor;

        if (typeof a === "string" && !isNaN(a))
          return compararNumeros(parseFloat(a), cond.operador, b);
        return comparar(a, cond.operador, b);
      });

      if (cumple) {
        valor = regla.asignacion;
        break;
      }
    }

    // Si ninguna regla se cumplió y hay "otro caso", usarlo
    if (valor === null && reglaOtroCaso) {
      valor = reglaOtroCaso.asignacion;
    }

    resultado[vector.nombre] = valor;
  }

  return resultado;
}

function comparar(a, op, b) {
  switch (op) {
    case "=":
      return a == b;
    case "!=":
      return a != b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    default:
      return false;
  }
}

function compararNumeros(a, op, b) {
  return comparar(a, op, parseFloat(b));
}

function evaluarFuncionDireccionamiento(fila, formula) {
  try {
    const fn = new Function("fila", `with(fila) { return ${formula}; }`);
    return fn(fila);
  } catch (e) {
    // console.error("Error evaluando fórmula:", e.message);
    return null;
  }
}

function aplicarVariablesGeneradas(combinaciones, variables) {
  const generadas = variables.filter((v) => v.variablegenerada === "SI");
  return combinaciones.map((comb) => {
    const nueva = { ...comb };
    for (const variable of generadas) {
      const { nombre, tipo, valor } = variable;
      if (!Array.isArray(valor)) continue;
      const operandos = valor.map((v) => parseFloat(comb[v]) || 0);
      let res = null;
      switch (tipo) {
        case "SUMA":
          res = operandos.reduce((a, b) => a + b, 0);
          break;
        case "RESTA":
          res = operandos.reduce((a, b) => a - b);
          break;
        case "MULTIPLICA":
          res = operandos.reduce((a, b) => a * b, 1);
          break;
        case "EXTRAE_MAX":
          res = Math.max(...operandos);
          break;
      }
      nueva[nombre] = res;
    }
    return nueva;
  });
}

function eliminarCombinacionesExistentes(modeloId) {
  return new Promise((resolve, reject) => {
    if (!modeloId) return resolve();
    db.run(`DELETE FROM combinaciones WHERE modeloId = ?`, [modeloId], (err) =>
      err ? reject(err) : resolve(true)
    );
  });
}

function guardarTodasLasCombinacionesEnBD(modeloId, combinaciones) {
  return new Promise((resolve, reject) => {
    if (!combinaciones.length) return resolve();
    const sql = `INSERT INTO combinaciones(modeloId, combinacionJson, datos, createdAt) VALUES (?, ?, ?, datetime('now'))`;
    const stmt = db.prepare(sql, (err) => err && reject(err));
    const errores = [];

    for (const fila of combinaciones) {
      try {
        const filaJson = JSON.stringify(fila);
        const direccionamiento =
          typeof fila.Imagen !== "undefined" ? fila.Imagen : null;
        stmt.run(
          modeloId,
          filaJson,
          direccionamiento,
          (err) => err && errores.push(err.message)
        );
      } catch (e) {
        errores.push(e.message);
      }
    }

    stmt.finalize((err) => {
      if (err || errores.length) return reject(new Error(errores.join("; ")));
      resolve();
    });
  });
}

exports.generarCombinaciones = async (req, res) => {
  try {
    const {
      variables = [],
      vectores = [],
      funcionDireccionamiento,
      modeloId = null,
    } = req.body;

    if (!Array.isArray(variables)) {
      return res.status(400).json({ error: "Variables inválidas" });
    }

    const combinaciones = generarCombinacionesAleatorias(variables, LIMITE);

    if (modeloId) await eliminarCombinacionesExistentes(modeloId);

    let resultado = aplicarVariablesGeneradas(combinaciones, variables);

    resultado = resultado.map((c) => {
      const vectoresEvaluados = evaluarVectores(c, vectores);
      return { ...c, ...vectoresEvaluados };
    });

    resultado = resultado.map((c) => {
      c["Imagen"] = funcionDireccionamiento
        ? evaluarFuncionDireccionamiento(c, funcionDireccionamiento)
        : null;
      return c;
    });

    if (modeloId) await guardarTodasLasCombinacionesEnBD(modeloId, resultado);

    res.json({ combinaciones: resultado });
  } catch (e) {
    console.error("Error en generarCombinaciones:", e);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
