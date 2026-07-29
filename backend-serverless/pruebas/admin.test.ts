import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

import { ingresarAdmin } from "../src/admin/servicio.js";
import {
  crearTokenAdmin,
  crearTokenProfesor,
  validarAdminDesdeEvento,
  validarProfesorDesdeEvento,
} from "../src/compartido/seguridad.js";
import type { ContadorIntentos } from "../src/acceso/repositorio.js";

function crearRepositorioRateLimitFalso(
  contadoresIniciales?: Record<string, ContadorIntentos>,
) {
  const contadores: Record<string, ContadorIntentos> = {
    ...contadoresIniciales,
  };
  return {
    async obtenerContador(ip: string) {
      return contadores[ip] ?? null;
    },
    async incrementarIntentosFallidos(ip: string, ventanaExpira: number) {
      const actual = contadores[ip] ?? { intentosFallidos: 0, ventanaExpira };
      if (!contadores[ip]) actual.ventanaExpira = ventanaExpira;
      actual.intentosFallidos += 1;
      contadores[ip] = actual;
      return actual.intentosFallidos;
    },
    async reiniciarContador(ip: string) {
      delete contadores[ip];
    },
  };
}

function eventoConToken(token: string): APIGatewayProxyEventV2 {
  return {
    headers: { authorization: `Bearer ${token}` },
    requestContext: { http: { method: "GET", path: "/api/admin/perfil" } },
  } as unknown as APIGatewayProxyEventV2;
}

describe("Admin — autenticación", () => {
  beforeEach(() => {
    process.env.CLAVE_ACCESO_ADMIN = "admin-test";
    process.env.ADMIN_ID = "admin-test-id";
    process.env.CLAVE_TOKEN =
      "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";
    process.env.CLAVE_ACCESO_PROFESOR = "profe123";
    process.env.PROFESOR_ID = "prof-test";
  });

  afterEach(() => {
    delete process.env.CLAVE_ACCESO_ADMIN;
    delete process.env.ADMIN_ID;
    delete process.env.CLAVE_TOKEN;
    delete process.env.CLAVE_ACCESO_PROFESOR;
    delete process.env.PROFESOR_ID;
  });

  it("emite token admin con adminId cuando la clave es correcta", async () => {
    const repo = crearRepositorioRateLimitFalso();
    const resultado = await ingresarAdmin("admin-test", "1.1.1.1", repo);
    expect(resultado.ok).toBe(true);
    expect(resultado.rol).toBe("admin");
    expect(resultado.adminId).toBe("admin-test-id");
    const [cuerpoB64] = resultado.token.split(".");
    const contenido = JSON.parse(
      Buffer.from(cuerpoB64!, "base64url").toString("utf8"),
    );
    expect(contenido.tipo).toBe("admin");
    expect(contenido.adminId).toBe("admin-test-id");
  });

  it("lanza CREDENCIALES_INVALIDAS con clave incorrecta", async () => {
    const repo = crearRepositorioRateLimitFalso();
    await expect(
      ingresarAdmin("clave-incorrecta", "1.1.1.1", repo),
    ).rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS", estado: 401 });
  });

  it("token de profesor es rechazado por validarAdminDesdeEvento con ROL_INVALIDO 403", () => {
    const tokenProfesor = crearTokenProfesor("prof-test");
    expect(() =>
      validarAdminDesdeEvento(eventoConToken(tokenProfesor)),
    ).toThrow(
      expect.objectContaining({ codigo: "ROL_INVALIDO", estado: 403 }),
    );
  });

  it("token de admin es rechazado por validarProfesorDesdeEvento con ROL_INVALIDO 403", () => {
    const tokenAdmin = crearTokenAdmin("admin-test-id");
    expect(() =>
      validarProfesorDesdeEvento(eventoConToken(tokenAdmin)),
    ).toThrow(
      expect.objectContaining({ codigo: "ROL_INVALIDO", estado: 403 }),
    );
  });
});

describe("Admin — rate limiting", () => {
  beforeEach(() => {
    process.env.CLAVE_ACCESO_ADMIN = "admin-test";
    process.env.ADMIN_ID = "admin-test-id";
    process.env.CLAVE_TOKEN =
      "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";
  });

  afterEach(() => {
    delete process.env.CLAVE_ACCESO_ADMIN;
    delete process.env.ADMIN_ID;
    delete process.env.CLAVE_TOKEN;
  });

  it("el 5° intento fallido retorna 429 LIMITE_INTENTOS_EXCEDIDO", async () => {
    const repo = crearRepositorioRateLimitFalso();

    for (let i = 0; i < 4; i++) {
      await expect(
        ingresarAdmin("clave-mala", "9.9.9.9", repo),
      ).rejects.toMatchObject({ estado: 401, codigo: "CREDENCIALES_INVALIDAS" });
    }

    await expect(
      ingresarAdmin("clave-mala", "9.9.9.9", repo),
    ).rejects.toMatchObject({ estado: 429, codigo: "LIMITE_INTENTOS_EXCEDIDO" });
  });

  it("login exitoso después de fallos resetea el contador", async () => {
    const repo = crearRepositorioRateLimitFalso();

    for (let i = 0; i < 3; i++) {
      await expect(
        ingresarAdmin("clave-mala", "8.8.8.8", repo),
      ).rejects.toMatchObject({ estado: 401 });
    }

    await ingresarAdmin("admin-test", "8.8.8.8", repo);

    const contador = await repo.obtenerContador("8.8.8.8");
    expect(contador).toBeNull();
  });
});
