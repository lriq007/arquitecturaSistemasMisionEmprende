import { beforeAll, describe, expect, it } from "vitest";
import { ingresarConCodigo } from "../src/acceso/servicio.js";
import { validarToken } from "../src/compartido/seguridad.js";
import type { ContadorIntentos, GrupoAcceso, RepositorioAcceso } from "../src/acceso/repositorio.js";

beforeAll(() => {
  process.env.CLAVE_TOKEN = "clave-de-prueba-test";
  process.env.DURACION_TOKEN_SEGUNDOS = "3600";
});

function crearRepositorioFalso(
  contadoresIniciales?: Record<string, ContadorIntentos>,
): RepositorioAcceso {
  const grupos: Record<string, GrupoAcceso> = {
    ABC123: {
      sesionId: "sesion-1",
      grupoId: "grupo-1",
      nombreGrupo: "Nombre Previo",
      codigoAcceso: "ABC123",
    },
  };
  const contadores: Record<string, ContadorIntentos> = { ...contadoresIniciales };

  return {
    async buscarPorCodigo(codigo: string) {
      return grupos[codigo] ?? null;
    },
    async actualizarNombre(sesionId, grupoId, nombreGrupo) {
      const grupo = Object.values(grupos).find(
        (g) => g.sesionId === sesionId && g.grupoId === grupoId,
      );
      if (grupo) grupo.nombreGrupo = nombreGrupo;
    },
    async obtenerContador(ip) {
      return contadores[ip] ?? null;
    },
    async incrementarIntentosFallidos(ip, ventanaExpira) {
      const actual = contadores[ip] ?? { intentosFallidos: 0, ventanaExpira };
      if (!contadores[ip]) actual.ventanaExpira = ventanaExpira;
      actual.intentosFallidos += 1;
      contadores[ip] = actual;
      return actual.intentosFallidos;
    },
    async reiniciarContador(ip) {
      delete contadores[ip];
    },
  };
}

describe("Acceso", () => {
  it("código válido retorna token que contiene sesionId, grupoId y nombreGrupo", async () => {
    const repositorio = crearRepositorioFalso();

    const resultado = await ingresarConCodigo("ABC123", "Mi Equipo", "1.1.1.1", repositorio);

    expect(resultado.ok).toBe(true);
    expect(resultado.grupo.nombre).toBe("Mi Equipo");
    expect(resultado.grupo.id).toBe("grupo-1");

    const contexto = validarToken(resultado.token);
    expect(contexto.sesionId).toBe("sesion-1");
    expect(contexto.grupoId).toBe("grupo-1");
    expect(contexto.nombreGrupo).toBe("Mi Equipo");
  });

  it("código inválido lanza ErrorAplicacion con código CODIGO_INVALIDO y estado 400", async () => {
    const repositorio = crearRepositorioFalso();

    await expect(
      ingresarConCodigo("INVALIDO", "Mi Equipo", "1.1.1.1", repositorio),
    ).rejects.toMatchObject({
      estado: 400,
      codigo: "CODIGO_INVALIDO",
      message: "Código de acceso no encontrado",
    });
  });

  it("código vacío lanza ErrorAplicacion con código CODIGO_REQUERIDO y estado 400", async () => {
    const repositorio = crearRepositorioFalso();

    await expect(
      ingresarConCodigo("   ", "Mi Equipo", "1.1.1.1", repositorio),
    ).rejects.toMatchObject({
      estado: 400,
      codigo: "CODIGO_REQUERIDO",
    });
  });

  it("código en minúsculas con espacios es normalizado y encuentra el grupo", async () => {
    const repositorio = crearRepositorioFalso();

    const resultado = await ingresarConCodigo(" abc123 ", "Mi Equipo", "1.1.1.1", repositorio);

    expect(resultado.ok).toBe(true);
    expect(resultado.grupo.id).toBe("grupo-1");
  });

  it("segundo login con mismo código retorna el mismo grupoId sin crear duplicado", async () => {
    const repositorio = crearRepositorioFalso();

    const primero = await ingresarConCodigo("ABC123", "Nombre 1", "1.1.1.1", repositorio);
    const segundo = await ingresarConCodigo("ABC123", "Nombre 2", "1.1.1.1", repositorio);

    expect(primero.grupo.id).toBe("grupo-1");
    expect(segundo.grupo.id).toBe("grupo-1");
    expect(primero.sesionId).toBe(segundo.sesionId);

    expect(segundo.token).toBeTruthy();
    const contexto = validarToken(segundo.token);
    expect(contexto.grupoId).toBe("grupo-1");
    expect(contexto.nombreGrupo).toBe("Nombre 2");
  });

  it("nombre de grupo vacío asigna un nombre aleatorio de la lista predefinida", async () => {
    const repositorio = crearRepositorioFalso();

    const resultado = await ingresarConCodigo("ABC123", "   ", "1.1.1.1", repositorio);

    expect(resultado.grupo.nombre).toBeTruthy();
    expect(resultado.grupo.nombre.length).toBeGreaterThan(0);
    expect(resultado.ok).toBe(true);

    const contexto = validarToken(resultado.token);
    expect(contexto.nombreGrupo).toBe(resultado.grupo.nombre);
  });
});

describe("Rate Limiting", () => {
  it("el 5° intento fallido de la misma IP retorna 429 con LIMITE_INTENTOS_EXCEDIDO", async () => {
    const repositorio = crearRepositorioFalso();

    for (let i = 0; i < 4; i++) {
      await expect(
        ingresarConCodigo("INVALIDO", "Mi Equipo", "2.2.2.2", repositorio),
      ).rejects.toMatchObject({ estado: 400, codigo: "CODIGO_INVALIDO" });
    }

    await expect(
      ingresarConCodigo("INVALIDO", "Mi Equipo", "2.2.2.2", repositorio),
    ).rejects.toMatchObject({
      estado: 429,
      codigo: "LIMITE_INTENTOS_EXCEDIDO",
      message: "Demasiados intentos. Espere 5 minutos.",
    });
  });

  it("el 6° intento (ventana activa) retorna 429 inmediato sin consultar el código", async () => {
    const repositorio = crearRepositorioFalso();

    for (let i = 0; i < 5; i++) {
      await expect(
        ingresarConCodigo("INVALIDO", "Mi Equipo", "3.3.3.3", repositorio),
      ).rejects.toMatchObject({ codigo: expect.stringMatching(/CODIGO_INVALIDO|LIMITE_INTENTOS_EXCEDIDO/) });
    }

    await expect(
      ingresarConCodigo("ABC123", "Mi Equipo", "3.3.3.3", repositorio),
    ).rejects.toMatchObject({
      estado: 429,
      codigo: "LIMITE_INTENTOS_EXCEDIDO",
    });
  });

  it("3 fallos + login exitoso resetean el contador; siguiente intento falla con 400 no 429", async () => {
    const repositorio = crearRepositorioFalso();

    for (let i = 0; i < 3; i++) {
      await expect(
        ingresarConCodigo("INVALIDO", "Mi Equipo", "4.4.4.4", repositorio),
      ).rejects.toMatchObject({ estado: 400, codigo: "CODIGO_INVALIDO" });
    }

    const resultado = await ingresarConCodigo("ABC123", "Mi Equipo", "4.4.4.4", repositorio);
    expect(resultado.ok).toBe(true);

    await expect(
      ingresarConCodigo("INVALIDO", "Mi Equipo", "4.4.4.4", repositorio),
    ).rejects.toMatchObject({
      estado: 400,
      codigo: "CODIGO_INVALIDO",
    });
  });

  it("login exitoso llama a reiniciarContador (contador queda en null)", async () => {
    const repositorio = crearRepositorioFalso();

    await expect(
      ingresarConCodigo("INVALIDO", "Mi Equipo", "5.5.5.5", repositorio),
    ).rejects.toMatchObject({ estado: 400, codigo: "CODIGO_INVALIDO" });

    await ingresarConCodigo("ABC123", "Mi Equipo", "5.5.5.5", repositorio);

    const contador = await repositorio.obtenerContador("5.5.5.5");
    expect(contador).toBeNull();
  });

  it("ventana expirada permite nuevo intento y procesa con normalidad (AC-2)", async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const repositorio = crearRepositorioFalso({
      "6.6.6.6": { intentosFallidos: 5, ventanaExpira: ahora - 1 },
    });

    await expect(
      ingresarConCodigo("INVALIDO", "Mi Equipo", "6.6.6.6", repositorio),
    ).rejects.toMatchObject({
      estado: 400,
      codigo: "CODIGO_INVALIDO",
    });
  });
});
