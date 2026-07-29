import {
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  ErrorAplicacion,
} from "../compartido/respuestas.js";
import {
  crearTokenProfesor,
} from "../compartido/seguridad.js";
import {
  FASES_ORDEN,
  TIEMPOS_POR_FASE,
} from "../compartido/maquinaEstados.js";
import type {
  AlumnoEntrada,
  ItemDynamo,
  RepositorioProfesor,
} from "./repositorio.js";

export type ModoCreacion =
  | "recomendado"
  | "dividir_dos"
  | "personalizado";

export interface CrearSesionesEntrada {
  nombre: string;
  correoProfesor: string;
  facultad: string;
  modoCreacion: ModoCreacion;
  cantidadSesiones?: number;
  gruposPorSesion?: number;
  alumnos: AlumnoEntrada[];
}

export type AccionSesion =
  | "siguiente_fase"
  | "fase_anterior"
  | "iniciar_timer"
  | "detener_timer"
  | "reiniciar_timer"
  | "timer_10";


function compararSeguro(
  valorA: string,
  valorB: string,
): boolean {
  const a = Buffer.from(valorA);
  const b = Buffer.from(valorB);

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

export function ingresarProfesor(codigo: string) {
  const esperado =
    process.env.CLAVE_ACCESO_PROFESOR || "profe123";

  if (
    !codigo ||
    !compararSeguro(codigo.trim(), esperado)
  ) {
    throw new ErrorAplicacion(
      "Código de profesor incorrecto",
      401,
      "CODIGO_PROFESOR_INVALIDO",
    );
  }

  const profesorId = process.env.PROFESOR_ID?.trim();

  if (!profesorId) {
    throw new ErrorAplicacion(
      "Variable de entorno PROFESOR_ID no configurada",
      500,
      "CONFIGURACION_INVALIDA",
    );
  }

  return {
    ok: true,
    token: crearTokenProfesor(profesorId),
    rol: "profesor",
    profesorId,
  };
}

function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

function validarAlumno(
  alumno: AlumnoEntrada,
  indice: number,
): AlumnoEntrada {
  const normalizado: AlumnoEntrada = {
    correo: String(alumno.correo || "")
      .trim()
      .toLowerCase(),
    rut: String(alumno.rut || "").trim(),
    nombre: String(alumno.nombre || "").trim(),
    apellidoPaterno: String(
      alumno.apellidoPaterno || "",
    ).trim(),
    apellidoMaterno: String(
      alumno.apellidoMaterno || "",
    ).trim(),
    carrera: String(alumno.carrera || "").trim(),
  };

  if (!normalizado.nombre) {
    throw new ErrorAplicacion(
      `El alumno de la fila ${indice + 2} no tiene nombre`,
      400,
      "ALUMNO_SIN_NOMBRE",
    );
  }

  return normalizado;
}

function repartirEquitativamente<T>(
  elementos: T[],
  cantidad: number,
): T[][] {
  const resultado: T[][] = [];
  let inicio = 0;

  for (let indice = 0; indice < cantidad; indice += 1) {
    const base = Math.floor(elementos.length / cantidad);
    const extra =
      indice < elementos.length % cantidad ? 1 : 0;
    const fin = inicio + base + extra;

    resultado.push(elementos.slice(inicio, fin));
    inicio = fin;
  }

  return resultado;
}

function codigoAcceso(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);

  return Array.from(
    bytes as Uint8Array,
    (byte: number) =>
      alfabeto[byte % alfabeto.length] ?? "A",
  ).join("");
}

function gruposRecomendados(
  totalAlumnos: number,
): number {
  return Math.max(1, Math.ceil(totalAlumnos / 8));
}

function calcularSegundosRestantes(
  sesion: ItemDynamo,
): number {
  if (!sesion.timerCorriendo || !sesion.timerFin) {
    return Number(sesion.segundosRestantes || 0);
  }

  const fin = new Date(String(sesion.timerFin)).getTime();
  const restantes = Math.ceil((fin - Date.now()) / 1000);

  return Math.max(restantes, 0);
}

function verificarPropiedadSesion(
  sesion: ItemDynamo,
  profesorId: string,
): void {
  const duenio = String(sesion.profesorId || "");

  if (duenio !== profesorId) {
    throw new ErrorAplicacion(
      "No tienes acceso a esta sesión",
      403,
      "ACCESO_DENEGADO",
    );
  }
}

export async function crearSesiones(
  profesorId: string,
  entrada: CrearSesionesEntrada,
  repositorio: RepositorioProfesor,
) {
  const nombre = String(entrada.nombre || "").trim();
  const correoProfesor = normalizarCorreo(
    String(entrada.correoProfesor || ""),
  );
  const facultad = String(entrada.facultad || "").trim();

  if (!nombre) {
    throw new ErrorAplicacion(
      "Debes ingresar un nombre para la sesión",
      400,
      "NOMBRE_REQUERIDO",
    );
  }

  if (!correoProfesor || !correoProfesor.includes("@")) {
    throw new ErrorAplicacion(
      "Debes ingresar un correo de profesor válido",
      400,
      "CORREO_INVALIDO",
    );
  }

  if (!facultad) {
    throw new ErrorAplicacion(
      "Debes seleccionar una facultad",
      400,
      "FACULTAD_REQUERIDA",
    );
  }

  const alumnos = (entrada.alumnos || []).map(
    validarAlumno,
  );

  if (!alumnos.length) {
    throw new ErrorAplicacion(
      "El archivo no contiene estudiantes",
      400,
      "SIN_ALUMNOS",
    );
  }

  const modo = entrada.modoCreacion || "recomendado";

  let cantidadSesiones = 1;

  if (modo === "dividir_dos") {
    cantidadSesiones = 2;
  } else if (modo === "personalizado") {
    cantidadSesiones = Math.max(
      1,
      Math.min(10, Number(entrada.cantidadSesiones || 1)),
    );
  }

  const alumnosPorSesion = repartirEquitativamente(
    alumnos,
    cantidadSesiones,
  );

  const ahora = new Date().toISOString();
  const items: ItemDynamo[] = [];
  const respuestaSesiones: Array<{
    sesionId: string;
    nombre: string;
    grupos: Array<{
      grupoId: string;
      nombreGrupo: string;
      codigoAcceso: string;
      integrantes: AlumnoEntrada[];
    }>;
  }> = [];

  await repositorio.guardarProfesor(
    correoProfesor,
    facultad,
  );

  alumnosPorSesion.forEach(
    (alumnosSesion, indiceSesion) => {
      const sesionId = randomUUID();

      const nombreSesion =
        cantidadSesiones === 1
          ? nombre
          : `${nombre} - Sala ${indiceSesion + 1}`;

      const cantidadGrupos =
        modo === "personalizado"
          ? Math.max(
              1,
              Math.min(
                30,
                Number(entrada.gruposPorSesion || 1),
              ),
            )
          : gruposRecomendados(alumnosSesion.length);

      const grupos = Array.from(
        { length: cantidadGrupos },
        (_, indiceGrupo) => ({
          grupoId: randomUUID(),
          nombreGrupo: `Grupo ${indiceGrupo + 1}`,
          codigoAcceso: codigoAcceso(),
          integrantes: [] as AlumnoEntrada[],
        }),
      );

      alumnosSesion.forEach((alumno, indiceAlumno) => {
        const grupo = grupos[indiceAlumno % grupos.length];

        if (grupo) {
          grupo.integrantes.push(alumno);
        }
      });

      items.push({
        PK: `SESION#${sesionId}`,
        SK: "METADATOS",
        GSI1PK: `PROFESOR#${profesorId}`,
        GSI1SK: `SESION#${ahora}#${sesionId}`,
        tipo: "SESION",
        sesionId,
        nombre: nombreSesion,
        correoProfesor,
        profesorId,
        facultad,
        fase: "configuracion",
        totalGrupos: grupos.length,
        totalAlumnos: alumnosSesion.length,
        gruposSopaCompletada: 0,
        timerCorriendo: false,
        segundosRestantes: 0,
        timerInicio: null,
        timerFin: null,
        inicioFaseHabilitado: false,
        fechaCreacion: ahora,
      });

      grupos.forEach((grupo) => {
        items.push({
          PK: `SESION#${sesionId}`,
          SK: `GRUPO#${grupo.grupoId}`,
          GSI1PK: `CODIGO#${grupo.codigoAcceso}`,
          GSI1SK: `GRUPO#${grupo.grupoId}`,
          tipo: "GRUPO",
          sesionId,
          grupoId: grupo.grupoId,
          nombreGrupo: grupo.nombreGrupo,
          codigoAcceso: grupo.codigoAcceso,
          tokens: 10,
          sopaCompletada: false,
          listoF1: false,
          listoF2: false,
          listoF3: false,
          listoF4: false,
          listoF5: false,
          listoF6: false,
          temaElegido: "",
          desafioNombre: "",
          legoCompletado: false,
          pitchCompletado: false,
        });

        grupo.integrantes.forEach((alumno) => {
          const alumnoId = randomUUID();

          items.push({
            PK: `SESION#${sesionId}`,
            SK: `ALUMNO#${alumnoId}`,
            tipo: "ALUMNO",
            alumnoId,
            sesionId,
            grupoId: grupo.grupoId,
            correo: alumno.correo,
            rut: alumno.rut,
            nombre: alumno.nombre,
            apellidoPaterno: alumno.apellidoPaterno,
            apellidoMaterno: alumno.apellidoMaterno,
            carrera: alumno.carrera,
          });
        });
      });

      respuestaSesiones.push({
        sesionId,
        nombre: nombreSesion,
        grupos,
      });
    },
  );

  await repositorio.guardarItems(items);

  return {
    ok: true,
    correoProfesor,
    sesiones: respuestaSesiones,
  };
}

export async function listarSesionesProfesor(
  profesorId: string,
  repositorio: RepositorioProfesor,
) {
  const sesiones = await repositorio.listarSesiones(profesorId);

  return {
    ok: true,
    sesiones,
  };
}

export async function obtenerControlSesion(
  sesionId: string,
  profesorId: string,
  repositorio: RepositorioProfesor,
) {
  const elementos =
    await repositorio.listarElementosSesion(sesionId);

  const sesion = elementos.find(
    (item) => item.SK === "METADATOS",
  );

  if (!sesion) {
    throw new ErrorAplicacion(
      "No se encontró la sesión",
      404,
      "SESION_NO_ENCONTRADA",
    );
  }

  verificarPropiedadSesion(sesion, profesorId);

  const grupos = elementos
    .filter((item) => item.tipo === "GRUPO")
    .map((item) => ({
      grupoId: String(item.grupoId || ""),
      nombreGrupo: String(item.nombreGrupo || "Grupo"),
      codigoAcceso: String(item.codigoAcceso || ""),
      tokens: Number(item.tokens || 0),
      listo: (() => {
        const faseActual = String(sesion.fase || "");

        if (faseActual === "f1_conocidos") {
          return Boolean(item.listoConocidos);
        }

        if (faseActual === "f1_pre_sopa") {
          return Boolean(item.listoF1);
        }

        if (
          faseActual === "f1_sopa" ||
          faseActual === "f1_ranking"
        ) {
          return Boolean(item.sopaCompletada);
        }

        return Boolean(
          item.listoF2 ||
            item.listoF3 ||
            item.listoF4 ||
            item.listoF5 ||
            item.listoF6,
        );
      })(),
      temaElegido: String(item.temaElegido || ""),
      desafioNombre: String(item.desafioNombre || ""),
      legoCompletado: Boolean(item.legoCompletado),
      pitchCompletado: Boolean(item.pitchCompletado),
    }))
    .sort((a, b) =>
      a.nombreGrupo.localeCompare(b.nombreGrupo),
    );

  const alumnos = elementos.filter(
    (item) => item.tipo === "ALUMNO",
  );

  const gruposConIntegrantes = grupos.map((grupo) => ({
    ...grupo,
    totalIntegrantes: alumnos.filter(
      (alumno) => alumno.grupoId === grupo.grupoId,
    ).length,
  }));

  return {
    ok: true,
    sesion: {
      sesionId,
      nombre: String(sesion.nombre || "Sesión"),
      fase: String(sesion.fase || "f1_bienvenida"),
      timerCorriendo: Boolean(sesion.timerCorriendo),
      segundosRestantes:
        calcularSegundosRestantes(sesion),
      totalGrupos: grupos.length,
      totalAlumnos: alumnos.length,
      fechaCreacion: String(sesion.fechaCreacion || ""),
    },
    grupos: gruposConIntegrantes,
  };
}

export async function ejecutarAccionSesion(
  sesionId: string,
  accion: AccionSesion,
  profesorId: string,
  repositorio: RepositorioProfesor,
) {
  const sesion = await repositorio.obtenerSesion(sesionId);

  if (!sesion) {
    throw new ErrorAplicacion(
      "No se encontró la sesión",
      404,
      "SESION_NO_ENCONTRADA",
    );
  }

  verificarPropiedadSesion(sesion, profesorId);

  const faseActual = String(
    sesion.fase || "configuracion",
  );

  const indiceActual = FASES_ORDEN.indexOf(
    faseActual as (typeof FASES_ORDEN)[number],
  );

  const ahora = new Date();
  const cambios: Record<string, unknown> = {};

  if (accion === "siguiente_fase") {
    if (
      indiceActual < 0 ||
      indiceActual >= FASES_ORDEN.length - 1
    ) {
      throw new ErrorAplicacion(
        "La sesión ya está en la última fase",
        400,
        "ULTIMA_FASE",
      );
    }

    const nuevaFase =
      FASES_ORDEN[indiceActual + 1] ?? faseActual;

    cambios.fase = nuevaFase;
    cambios.segundosRestantes =
      TIEMPOS_POR_FASE[nuevaFase] || 0;
    cambios.timerCorriendo = false;
    cambios.timerInicio = null;
    cambios.timerFin = null;
  }

  if (accion === "fase_anterior") {
    if (indiceActual <= 0) {
      throw new ErrorAplicacion(
        "La sesión ya está en la primera fase",
        400,
        "PRIMERA_FASE",
      );
    }

    const nuevaFase =
      FASES_ORDEN[indiceActual - 1] ?? faseActual;

    cambios.fase = nuevaFase;
    cambios.segundosRestantes =
      TIEMPOS_POR_FASE[nuevaFase] || 0;
    cambios.timerCorriendo = false;
    cambios.timerInicio = null;
    cambios.timerFin = null;
  }

  if (accion === "iniciar_timer") {
    const segundos = Math.max(
      0,
      calcularSegundosRestantes(sesion) ||
        TIEMPOS_POR_FASE[faseActual] ||
        0,
    );

    cambios.segundosRestantes = segundos;
    cambios.timerCorriendo = segundos > 0;
    cambios.timerInicio =
      segundos > 0 ? ahora.toISOString() : null;
    cambios.timerFin =
      segundos > 0
        ? new Date(
            ahora.getTime() + segundos * 1000,
          ).toISOString()
        : null;
  }

  if (accion === "detener_timer") {
    cambios.segundosRestantes =
      calcularSegundosRestantes(sesion);
    cambios.timerCorriendo = false;
    cambios.timerInicio = null;
    cambios.timerFin = null;
  }

  if (accion === "reiniciar_timer") {
    cambios.segundosRestantes =
      TIEMPOS_POR_FASE[faseActual] || 0;
    cambios.timerCorriendo = false;
    cambios.timerInicio = null;
    cambios.timerFin = null;
  }

  if (accion === "timer_10") {
    cambios.segundosRestantes = 10;
    cambios.timerCorriendo = true;
    cambios.timerInicio = ahora.toISOString();
    cambios.timerFin = new Date(
      ahora.getTime() + 10_000,
    ).toISOString();
  }

  if (!Object.keys(cambios).length) {
    throw new ErrorAplicacion(
      "Acción no válida",
      400,
      "ACCION_INVALIDA",
    );
  }

  await repositorio.actualizarSesion(
    sesionId,
    cambios,
  );

  return obtenerControlSesion(sesionId, profesorId, repositorio);
}
