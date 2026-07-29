import { afterEach, describe, expect, it } from "vitest";

import type {
  ItemDynamo,
  RepositorioProfesor,
  SesionResumen,
} from "../src/profesor/repositorio.js";
import {
  crearSesiones,
  ejecutarAccionSesion,
  ingresarProfesor,
  listarSesionesProfesor,
  obtenerControlSesion,
} from "../src/profesor/servicio.js";

afterEach(() => {
  delete process.env.CLAVE_ACCESO_PROFESOR;
  delete process.env.CLAVE_TOKEN;
  delete process.env.PROFESOR_ID;
});

function repositorioEnMemoria() {
  const items: ItemDynamo[] = [];

  const repositorio: RepositorioProfesor = {
    async guardarProfesor() {},

    async guardarItems(nuevos) {
      items.push(...nuevos);
    },

    async listarSesiones(): Promise<SesionResumen[]> {
      return [];
    },

    async obtenerSesion() {
      return null;
    },

    async listarElementosSesion() {
      return [];
    },

    async actualizarSesion() {},
  };

  return {
    repositorio,
    items,
  };
}

describe("Profesor y creación de sesiones", () => {
  it("permite ingresar con la clave configurada", () => {
    process.env.CLAVE_ACCESO_PROFESOR = "profe123";
    process.env.CLAVE_TOKEN =
      "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";
    process.env.PROFESOR_ID = "prof-test";

    const resultado = ingresarProfesor("profe123");

    expect(resultado.ok).toBe(true);
    expect(resultado.rol).toBe("profesor");
    expect(resultado.token).toContain(".");
    expect(resultado.profesorId).toBe("prof-test");
  });

  it("el token emitido por ingresarProfesor incluye profesorId extraíble", () => {
    process.env.CLAVE_ACCESO_PROFESOR = "profe123";
    process.env.CLAVE_TOKEN =
      "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";
    process.env.PROFESOR_ID = "prof-test";

    const resultado = ingresarProfesor("profe123");

    const [cuerpoB64] = resultado.token.split(".");
    const contenido = JSON.parse(
      Buffer.from(cuerpoB64!, "base64url").toString("utf8"),
    );

    expect(contenido.profesorId).toBe("prof-test");
  });

  it("crea grupos recomendados de máximo ocho alumnos", async () => {
    const memoria = repositorioEnMemoria();

    const alumnos = Array.from(
      { length: 17 },
      (_, indice) => ({
        correo: `alumno${indice}@udd.cl`,
        rut: "",
        nombre: `Alumno ${indice + 1}`,
        apellidoPaterno: "",
        apellidoMaterno: "",
        carrera: "Ingeniería",
      }),
    );

    const resultado = await crearSesiones(
      "prof-test",
      {
        nombre: "Prueba",
        correoProfesor: "profesor@udd.cl",
        facultad: "Ingeniería",
        modoCreacion: "recomendado",
        alumnos,
      },
      memoria.repositorio,
    );

    expect(resultado.sesiones).toHaveLength(1);
    expect(resultado.sesiones[0]!.grupos).toHaveLength(3);

    const gruposGuardados = memoria.items.filter(
      (item) => item.tipo === "GRUPO",
    );

    expect(gruposGuardados).toHaveLength(3);
  });

  it("divide una sala en dos sesiones", async () => {
    const memoria = repositorioEnMemoria();

    const resultado = await crearSesiones(
      "prof-test",
      {
        nombre: "Curso",
        correoProfesor: "profesor@udd.cl",
        facultad: "Ingeniería",
        modoCreacion: "dividir_dos",
        alumnos: Array.from(
          { length: 10 },
          (_, indice) => ({
            correo: "",
            rut: "",
            nombre: `Alumno ${indice + 1}`,
            apellidoPaterno: "",
            apellidoMaterno: "",
            carrera: "",
          }),
        ),
      },
      memoria.repositorio,
    );

    expect(resultado.sesiones).toHaveLength(2);
    expect(resultado.sesiones[0]!.nombre).toContain("Sala 1");
    expect(resultado.sesiones[1]!.nombre).toContain("Sala 2");
  });
});

function repositorioConSesiones(
  itemsPorSesion: Record<
    string,
    { profesorId: string; sesion: Partial<ItemDynamo>; grupos?: Partial<ItemDynamo>[] }
  >,
): RepositorioProfesor {
  return {
    async guardarProfesor() {},

    async guardarItems() {},

    async listarSesiones(profesorId: string): Promise<SesionResumen[]> {
      return Object.entries(itemsPorSesion)
        .filter(([, v]) => v.profesorId === profesorId)
        .map(([sesionId, v]) => ({
          sesionId,
          nombre: String(v.sesion.nombre ?? "Sesión"),
          correoProfesor: String(v.sesion.correoProfesor ?? ""),
          facultad: "",
          fase: "configuracion",
          fechaCreacion: new Date().toISOString(),
          totalGrupos: 1,
          totalAlumnos: 0,
          profesorId: v.profesorId,
        }));
    },

    async obtenerSesion(sesionId: string): Promise<ItemDynamo | null> {
      const entrada = itemsPorSesion[sesionId];

      if (!entrada) return null;

      return {
        PK: `SESION#${sesionId}`,
        SK: "METADATOS",
        tipo: "SESION",
        sesionId,
        profesorId: entrada.profesorId,
        fase: "configuracion",
        ...entrada.sesion,
      } as ItemDynamo;
    },

    async listarElementosSesion(sesionId: string): Promise<ItemDynamo[]> {
      const entrada = itemsPorSesion[sesionId];

      if (!entrada) return [];

      const metadatos: ItemDynamo = {
        PK: `SESION#${sesionId}`,
        SK: "METADATOS",
        tipo: "SESION",
        sesionId,
        profesorId: entrada.profesorId,
        fase: "configuracion",
        ...entrada.sesion,
      };

      return [
        metadatos,
        ...(entrada.grupos ?? []).map(
          (g) =>
            ({
              PK: `SESION#${sesionId}`,
              SK: `GRUPO#${String(g.grupoId ?? "g1")}`,
              tipo: "GRUPO",
              ...g,
            }) as ItemDynamo,
        ),
      ];
    },

    async actualizarSesion() {},
  };
}

describe("Estado inicial de sesión (AC-1, AC-3 — historia 2-1)", () => {
  it("crearSesiones produce items SESION con fase 'configuracion'", async () => {
    const memoria = repositorioEnMemoria();

    await crearSesiones(
      "prof-test",
      {
        nombre: "Sesión Test",
        correoProfesor: "profesor@udd.cl",
        facultad: "Ingeniería",
        modoCreacion: "recomendado",
        alumnos: Array.from({ length: 4 }, (_, i) => ({
          correo: `a${i}@udd.cl`,
          rut: "",
          nombre: `Alumno ${i + 1}`,
          apellidoPaterno: "",
          apellidoMaterno: "",
          carrera: "",
        })),
      },
      memoria.repositorio,
    );

    const itemSesion = memoria.items.find(
      (item) => item.tipo === "SESION",
    );

    expect(itemSesion).toBeDefined();
    expect(itemSesion!.fase).toBe("configuracion");
  });

  it("ejecutarAccionSesion con siguiente_fase desde 'configuracion' avanza a 'f1_bienvenida'", async () => {
    process.env.CLAVE_TOKEN =
      "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";

    let fasePersistida = "configuracion";

    const repositorio: RepositorioProfesor = {
      async guardarProfesor() {},
      async guardarItems() {},
      async listarSesiones() { return []; },
      async obtenerSesion() {
        return {
          PK: "SESION#sesion-cfg",
          SK: "METADATOS",
          tipo: "SESION",
          sesionId: "sesion-cfg",
          profesorId: "prof-A",
          fase: fasePersistida,
        } as ItemDynamo;
      },
      async listarElementosSesion() {
        return [{
          PK: "SESION#sesion-cfg",
          SK: "METADATOS",
          tipo: "SESION",
          sesionId: "sesion-cfg",
          profesorId: "prof-A",
          fase: fasePersistida,
        } as ItemDynamo];
      },
      async actualizarSesion(_id, cambios) {
        if (typeof cambios.fase === "string") {
          fasePersistida = cambios.fase;
        }
      },
    };

    const resultado = await ejecutarAccionSesion(
      "sesion-cfg",
      "siguiente_fase",
      "prof-A",
      repositorio,
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.sesion.fase).toBe("f1_bienvenida");
  });
});

describe("Aislamiento de sesiones por profesor (historia 1-4)", () => {
  it("listarSesionesProfesor devuelve solo las sesiones del profesorId consultado (AC-1)", async () => {
    const repositorio = repositorioConSesiones({
      "sesion-A": { profesorId: "prof-A", sesion: { nombre: "Sesión A" } },
      "sesion-B": { profesorId: "prof-B", sesion: { nombre: "Sesión B" } },
    });

    const resultado = await listarSesionesProfesor("prof-A", repositorio);

    expect(resultado.sesiones).toHaveLength(1);
    expect(resultado.sesiones[0]!.sesionId).toBe("sesion-A");
    expect(resultado.sesiones[0]!.profesorId).toBe("prof-A");
  });

  it("obtenerControlSesion lanza ACCESO_DENEGADO si la sesión no pertenece al profesor (AC-2)", async () => {
    const repositorio = repositorioConSesiones({
      "sesion-A": { profesorId: "prof-A", sesion: { nombre: "Sesión A" } },
    });

    await expect(
      obtenerControlSesion("sesion-A", "prof-B", repositorio),
    ).rejects.toMatchObject({ codigo: "ACCESO_DENEGADO", estado: 403 });
  });

  it("ejecutarAccionSesion lanza ACCESO_DENEGADO si la sesión no pertenece al profesor (AC-2)", async () => {
    process.env.CLAVE_TOKEN =
      "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";

    const repositorio = repositorioConSesiones({
      "sesion-A": {
        profesorId: "prof-A",
        sesion: { nombre: "Sesión A", fase: "f1_bienvenida" },
      },
    });

    await expect(
      ejecutarAccionSesion("sesion-A", "siguiente_fase", "prof-B", repositorio),
    ).rejects.toMatchObject({ codigo: "ACCESO_DENEGADO", estado: 403 });
  });

  it("obtenerControlSesion permite al propietario acceder a su propia sesión (AC-2 happy path)", async () => {
    const repositorio = repositorioConSesiones({
      "sesion-A": { profesorId: "prof-A", sesion: { nombre: "Sesión A" } },
    });

    const resultado = await obtenerControlSesion(
      "sesion-A",
      "prof-A",
      repositorio,
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.sesion.sesionId).toBe("sesion-A");
  });

  it("ejecutarAccionSesion permite al propietario ejecutar acciones en su propia sesión (AC-2 happy path)", async () => {
    process.env.CLAVE_TOKEN =
      "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";

    const repositorio = repositorioConSesiones({
      "sesion-A": {
        profesorId: "prof-A",
        sesion: { nombre: "Sesión A", fase: "f1_bienvenida" },
      },
    });

    const resultado = await ejecutarAccionSesion(
      "sesion-A",
      "siguiente_fase",
      "prof-A",
      repositorio,
    );

    expect(resultado.ok).toBe(true);
  });
});

describe("Códigos de acceso de grupos (AC-4 — historia 2-1)", () => {
  it("cada código tiene exactamente 6 caracteres del alfabeto permitido", async () => {
    const memoria = repositorioEnMemoria();
    const alfabetoPermitido = new Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");

    await crearSesiones(
      "prof-test",
      {
        nombre: "Test AC-4",
        correoProfesor: "profesor@udd.cl",
        facultad: "Ingeniería",
        modoCreacion: "recomendado",
        alumnos: Array.from({ length: 8 }, (_, i) => ({
          correo: `a${i}@udd.cl`,
          rut: "",
          nombre: `Alumno ${i + 1}`,
          apellidoPaterno: "",
          apellidoMaterno: "",
          carrera: "",
        })),
      },
      memoria.repositorio,
    );

    const grupos = memoria.items.filter((item) => item.tipo === "GRUPO");

    expect(grupos.length).toBeGreaterThan(0);

    for (const grupo of grupos) {
      const codigo = String(grupo.codigoAcceso ?? "");

      expect(codigo).toHaveLength(6);

      for (const caracter of codigo) {
        expect(alfabetoPermitido.has(caracter)).toBe(true);
      }
    }
  });

  it("los N códigos generados para una sesión son únicos entre sí", async () => {
    const memoria = repositorioEnMemoria();

    await crearSesiones(
      "prof-test",
      {
        nombre: "Test unicidad",
        correoProfesor: "profesor@udd.cl",
        facultad: "Ingeniería",
        modoCreacion: "recomendado",
        alumnos: Array.from({ length: 24 }, (_, i) => ({
          correo: `a${i}@udd.cl`,
          rut: "",
          nombre: `Alumno ${i + 1}`,
          apellidoPaterno: "",
          apellidoMaterno: "",
          carrera: "",
        })),
      },
      memoria.repositorio,
    );

    const codigos = memoria.items
      .filter((item) => item.tipo === "GRUPO")
      .map((item) => String(item.codigoAcceso ?? ""));

    const unicos = new Set(codigos);

    expect(unicos.size).toBe(codigos.length);
  });
});
