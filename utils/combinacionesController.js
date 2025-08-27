const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./miproyecto.db");

const LIMITE_POR_IMAGEN = 10;
const MAX_INTENTOS_GENERACION = 30000;
const MAX_INTENTOS_GLOBAL = 150000;

function generarValoresClaveNumero(total, decimales = 0) {
  const maxEntero = Math.pow(10, total) - 1; // Ej: 999 si total=3
  const maxExcedido = Math.pow(10, total + 1) - 1; // Ej: 9999 si total=3
  const factor = Math.pow(10, decimales);

  function formatear(num) {
    return Number((Math.floor(num * factor) / factor).toFixed(decimales));
  }

  return [
    formatear(0),
    formatear(maxEntero + (factor - 1) / factor), // Ej: 999.99
    formatear(maxExcedido + (factor - 1) / factor), // Ej: 9999.99
  ];
}

function generarValoresParaVariable(variable) {
  const {
    tipo,
    longitud = 1,
    total = 1,
    decimales = 0,
    valor,
    variablegenerada,
  } = variable;

  if (variablegenerada === "NO" && valor) {
    if (typeof valor === "string" && valor.trim() !== "") {
      const valoresLimpios = valor
        .replace(/[()]/g, "")
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v !== "")
        .map((v) => {
          const limpio = v.trim();
          if (limpio.toUpperCase() === "NULL") return "NULL";
          if (limpio === "") return "";
          return isNaN(limpio) ? limpio : Number(limpio);
        });

      if (valoresLimpios.length > 0) return valoresLimpios;
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
        .filter((v) => v !== "");
      if (valoresLimpios.length > 0) return valoresLimpios;
    }
  }

  switch (tipo.toLowerCase()) {
    case "varchar2":
    case "char":
      return ["NULL", "A".repeat(longitud), "A".repeat(longitud + 1)];
    case "number":
      return generarValoresClaveNumero(total, decimales);
    case "boolean":
      return [true, false];
    case "date":
      return ["2025-01-01", "2025-06-01", "2025-12-31"];
    default:
      return ["N/A"];
  }
}

function balancearCerosEnVariablesBase(combinaciones, variables, limite) {
  const porcentajeCeros = 0.05; // 5% combinaciones con ceros
  const cantidadForzarCerosPorVariable = Math.max(
    1,
    Math.floor(limite * porcentajeCeros)
  );
  const cantidadForzarNoCeroPorVariable = Math.max(
    1,
    Math.floor(limite * porcentajeCeros)
  );

  const generadas = variables.filter((v) => v.variablegenerada === "SI");

  for (const variableGenerada of generadas) {
    const operandos = variableGenerada.valor;
    if (!Array.isArray(operandos) || operandos.length === 0) continue;

    // Forzar ceros en variables base
    const indicesSetCeros = new Set();
    while (
      indicesSetCeros.size < cantidadForzarCerosPorVariable &&
      indicesSetCeros.size < combinaciones.length
    ) {
      indicesSetCeros.add(Math.floor(Math.random() * combinaciones.length));
    }
    for (const idx of indicesSetCeros) {
      for (const varBase of operandos) {
        if (combinaciones[idx].hasOwnProperty(varBase)) {
          const varDef = variables.find((v) => v.nombre === varBase);
          if (!varDef) continue;

          const tipoVar = varDef.tipo.toLowerCase();
          if (tipoVar === "number") {
            combinaciones[idx][varBase] = 0;
          } else if (tipoVar === "varchar2" || tipoVar === "char") {
            combinaciones[idx][varBase] = "NULL";
          } else if (tipoVar === "boolean") {
            combinaciones[idx][varBase] = false;
          } else if (tipoVar === "date") {
            combinaciones[idx][varBase] = null;
          } else {
            combinaciones[idx][varBase] = 0;
          }
        }
      }
    }

    // Forzar valores no ceros en variables base
    for (const varBase of operandos) {
      const varDef = variables.find((v) => v.nombre === varBase);
      if (!varDef) continue;

      const valoresValidos = [];

      if (varDef.variablegenerada === "NO" && varDef.valor) {
        if (typeof varDef.valor === "string" && varDef.valor.trim() !== "") {
          valoresValidos.push(
            ...varDef.valor
              .replace(/[()]/g, "")
              .split(",")
              .map((v) => v.trim())
              .filter(
                (v) => v !== "" && v.toUpperCase() !== "NULL" && v !== "0"
              )
              .map((v) => (isNaN(v) ? v : Number(v)))
          );
        } else if (Array.isArray(varDef.valor)) {
          valoresValidos.push(
            ...varDef.valor.filter(
              (v) =>
                v !== "" &&
                v !== 0 &&
                v !== "0" &&
                v !== null &&
                v.toString().toUpperCase() !== "NULL"
            )
          );
        }
      }

      if (valoresValidos.length === 0) {
        switch (varDef.tipo.toLowerCase()) {
          case "varchar2":
          case "char":
            valoresValidos.push("A".repeat(varDef.longitud || 1));
            break;
          case "number":
            valoresValidos.push(1);
            break;
          case "boolean":
            valoresValidos.push(true);
            break;
          case "date":
            valoresValidos.push("2025-06-01");
            break;
          default:
            valoresValidos.push("X");
            break;
        }
      }

      const indicesSetNoCero = new Set();
      while (
        indicesSetNoCero.size < cantidadForzarNoCeroPorVariable &&
        indicesSetNoCero.size < combinaciones.length
      ) {
        indicesSetNoCero.add(Math.floor(Math.random() * combinaciones.length));
      }

      for (const idx of indicesSetNoCero) {
        if (combinaciones[idx].hasOwnProperty(varBase)) {
          const valNoCero =
            valoresValidos[Math.floor(Math.random() * valoresValidos.length)];
          combinaciones[idx][varBase] = valNoCero;
        }
      }
    }
  }
}

function evaluarVectores(fila, vectores) {
  const resultado = {};
  for (const vector of vectores) {
    let valor = null;
    let reglaOtroCaso = null;

    for (const regla of vector.reglas) {
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

async function generarCombinacionesConCoberturaCompleta({
  variables,
  vectores,
  funcionDireccionamiento,
  modeloId = null,
  limitePorImagen = LIMITE_POR_IMAGEN,
  maxIntentosPorRonda = MAX_INTENTOS_GENERACION,
  maxIntentosGlobal = MAX_INTENTOS_GLOBAL,
  imagenesEsperadas = null,
}) {
  const valoresPorVariable = variables.map(generarValoresParaVariable);
  const nombres = variables.map((v) => v?.nombre ?? "");

  const imagenesContador = {};
  const combinacionesSet = new Set();
  let combinacionesFinales = [];

  let intentosGlobal = 0;

  function generarRonda() {
    const combinacionesRonda = [];
    let intentos = 0;

    while (
      intentos < maxIntentosPorRonda &&
      intentosGlobal < maxIntentosGlobal
    ) {
      const nuevaComb = {};
      for (let i = 0; i < variables.length; i++) {
        const valores = valoresPorVariable[i];
        const val = valores[Math.floor(Math.random() * valores.length)];
        nuevaComb[nombres[i]] = val;
      }

      const keyBase = JSON.stringify(nuevaComb);
      if (combinacionesSet.has(keyBase)) {
        intentos++;
        intentosGlobal++;
        continue;
      }

      combinacionesSet.add(keyBase);
      combinacionesRonda.push(nuevaComb);

      intentos++;
      intentosGlobal++;
    }

    return combinacionesRonda;
  }

  while (intentosGlobal < maxIntentosGlobal) {
    let nuevasComb = generarRonda();

    balancearCerosEnVariablesBase(nuevasComb, variables, nuevasComb.length);

    nuevasComb = aplicarVariablesGeneradas(nuevasComb, variables);

    nuevasComb = nuevasComb.map((c) => {
      const vectoresEvaluados = evaluarVectores(c, vectores);
      return { ...c, ...vectoresEvaluados };
    });

    nuevasComb = nuevasComb.map((c) => {
      c["Imagen"] = funcionDireccionamiento
        ? evaluarFuncionDireccionamiento(c, funcionDireccionamiento)
        : null;
      return c;
    });

    const combinacionesFiltradas = [];
    for (const c of nuevasComb) {
      const img = c["Imagen"];
      if (imagenesEsperadas && !imagenesEsperadas.includes(img)) continue;

      if ((imagenesContador[img] || 0) < limitePorImagen) {
        combinacionesFiltradas.push(c);
        imagenesContador[img] = (imagenesContador[img] || 0) + 1;
      }
    }

    combinacionesFinales = combinacionesFinales.concat(combinacionesFiltradas);

    if (imagenesEsperadas) {
      const todasCubiertas = imagenesEsperadas.every(
        (img) => (imagenesContador[img] || 0) >= limitePorImagen
      );
      if (todasCubiertas) break;
    } else {
      if (intentosGlobal >= maxIntentosGlobal) break;
    }
  }

  if (modeloId) {
    await eliminarCombinacionesExistentes(modeloId);
    await guardarTodasLasCombinacionesEnBD(modeloId, combinacionesFinales);
  }

  const imagenesEncontradas = Object.entries(imagenesContador).map(
    ([imagen, count]) => ({ imagen, count })
  );

  let imagenesFaltantes = [];
  if (imagenesEsperadas) {
    imagenesFaltantes = imagenesEsperadas.filter(
      (img) => (imagenesContador[img] || 0) < limitePorImagen
    );
  }

  return {
    combinaciones: combinacionesFinales,
    imagenesEncontradas,
    imagenesFaltantes,
  };
}

exports.generarCombinaciones = async (req, res) => {
  try {
    const {
      variables = [],
      vectores = [],
      funcionDireccionamiento,
      modeloId = null,
      limitePorImagen = LIMITE_POR_IMAGEN,
      imagenesEsperadas = null,
    } = req.body;

    if (!Array.isArray(variables)) {
      return res.status(400).json({ error: "Variables inválidas" });
    }

    const resultado = await generarCombinacionesConCoberturaCompleta({
      variables,
      vectores,
      funcionDireccionamiento,
      modeloId,
      limitePorImagen,
      imagenesEsperadas,
    });

    res.json(resultado);
  } catch (e) {
    console.error("Error en generarCombinaciones:", e);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
