import { crearToken } from "../compartido/seguridad.js";
import { ErrorAplicacion } from "../compartido/respuestas.js";
import type { RepositorioAcceso } from "./repositorio.js";

const MAX_INTENTOS = 5;
const VENTANA_SEGUNDOS = 300;

const nombresAleatorios = [
  "Equipo Cóndor",
  "Misión Alfa",
  "Agentes UDD",
  "Mentes Creativas",
  "Los Innovadores",
  "Escuadrón Delta",
  "Visionarios UDD",
  "Código Naranja",
  "Equipo Fénix",
  "StartUp Squad",
  "Los Estrategas",
  "Comando Emprende",
];

export async function ingresarConCodigo(
  codigoRecibido: string,
  nombreRecibido: string,
  ip: string,
  repositorio: RepositorioAcceso,
) {
  const ahora = Math.floor(Date.now() / 1000);

  const contador = await repositorio.obtenerContador(ip);
  if (contador && contador.intentosFallidos >= MAX_INTENTOS && contador.ventanaExpira > ahora) {
    throw new ErrorAplicacion(
      "Demasiados intentos. Espere 5 minutos.",
      429,
      "LIMITE_INTENTOS_EXCEDIDO",
    );
  }

  // TTL de DynamoDB puede tardar en eliminar ítems expirados; limpiar manualmente
  if (contador && contador.ventanaExpira <= ahora) {
    await repositorio.reiniciarContador(ip);
  }

  const codigo = codigoRecibido.trim().toUpperCase();

  if (!codigo) {
    throw new ErrorAplicacion(
      "Debes ingresar un código de grupo",
      400,
      "CODIGO_REQUERIDO",
    );
  }

  const grupo = await repositorio.buscarPorCodigo(codigo);

  if (!grupo) {
    const ventanaExpira = ahora + VENTANA_SEGUNDOS;
    const nuevoConteo = await repositorio.incrementarIntentosFallidos(ip, ventanaExpira);
    if (nuevoConteo >= MAX_INTENTOS) {
      throw new ErrorAplicacion(
        "Demasiados intentos. Espere 5 minutos.",
        429,
        "LIMITE_INTENTOS_EXCEDIDO",
      );
    }
    throw new ErrorAplicacion(
      "Código de acceso no encontrado",
      400,
      "CODIGO_INVALIDO",
    );
  }

  await repositorio.reiniciarContador(ip);

  const nombreLimpio = nombreRecibido.trim().slice(0, 100);

  const indiceAleatorio = Math.floor(
    Math.random() * nombresAleatorios.length,
  );

  const nombreAleatorio =
    nombresAleatorios[indiceAleatorio] ?? "Equipo UDD";

  const nombreGrupo = nombreLimpio || nombreAleatorio;

  await repositorio.actualizarNombre(
    grupo.sesionId,
    grupo.grupoId,
    nombreGrupo,
  );

  const token = crearToken({
    sesionId: grupo.sesionId,
    grupoId: grupo.grupoId,
    nombreGrupo,
  });

  return {
    ok: true,
    token,
    grupo: {
      id: grupo.grupoId,
      nombre: nombreGrupo,
    },
    sesionId: grupo.sesionId,
  };
}
