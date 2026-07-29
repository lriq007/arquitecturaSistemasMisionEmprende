import { timingSafeEqual } from "node:crypto";

import { ErrorAplicacion } from "../compartido/respuestas.js";
import { crearTokenAdmin } from "../compartido/seguridad.js";
import type { RepositorioAcceso } from "../acceso/repositorio.js";

const MAX_INTENTOS_ADMIN = 5;
const VENTANA_SEGUNDOS_ADMIN = 300;

type RepositorioRateLimit = Pick<
  RepositorioAcceso,
  "obtenerContador" | "incrementarIntentosFallidos" | "reiniciarContador"
>;

export async function ingresarAdmin(
  clave: string,
  ip: string,
  repositorioRateLimit: RepositorioRateLimit,
): Promise<{ ok: true; token: string; rol: "admin"; adminId: string }> {
  const ahora = Math.floor(Date.now() / 1000);

  const contador = await repositorioRateLimit.obtenerContador(ip);
  if (
    contador &&
    contador.intentosFallidos >= MAX_INTENTOS_ADMIN &&
    contador.ventanaExpira > ahora
  ) {
    throw new ErrorAplicacion(
      "Demasiados intentos. Espere 5 minutos.",
      429,
      "LIMITE_INTENTOS_EXCEDIDO",
    );
  }
  if (contador && contador.ventanaExpira <= ahora) {
    await repositorioRateLimit.reiniciarContador(ip);
  }

  const claveEsperada = process.env.CLAVE_ACCESO_ADMIN || "admin123";

  const b1 = Buffer.from(clave);
  const b2 = Buffer.from(claveEsperada);

  const claveValida = b1.length === b2.length && timingSafeEqual(b1, b2);

  if (!claveValida) {
    const ventanaExpira = ahora + VENTANA_SEGUNDOS_ADMIN;
    const nuevoConteo = await repositorioRateLimit.incrementarIntentosFallidos(
      ip,
      ventanaExpira,
    );
    if (nuevoConteo >= MAX_INTENTOS_ADMIN) {
      throw new ErrorAplicacion(
        "Demasiados intentos. Espere 5 minutos.",
        429,
        "LIMITE_INTENTOS_EXCEDIDO",
      );
    }
    throw new ErrorAplicacion(
      "Clave de administrador incorrecta",
      401,
      "CREDENCIALES_INVALIDAS",
    );
  }

  await repositorioRateLimit.reiniciarContador(ip);

  const adminId = process.env.ADMIN_ID?.trim();

  if (!adminId) {
    throw new ErrorAplicacion(
      "Variable de entorno ADMIN_ID no configurada",
      500,
      "CONFIGURACION_INVALIDA",
    );
  }

  return {
    ok: true,
    token: crearTokenAdmin(adminId),
    rol: "admin",
    adminId,
  };
}
