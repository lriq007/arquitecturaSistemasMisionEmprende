/**
 * Migración: agrega profesorId y corrige GSI1PK en sesiones legacy.
 *
 * Antes de esta migración (historia 2-1):
 *   GSI1PK = PROFESOR#{correoProfesor}   (no hay campo profesorId)
 * Después:
 *   GSI1PK = PROFESOR#{profesorId}       (campo profesorId presente)
 *
 * Uso:
 *   NOMBRE_TABLA=MisionEmprende PROFESOR_ID=profesor-principal npx tsx scripts/migrarProfesorId.ts
 *
 * Para DynamoDB local:
 *   DYNAMODB_ENDPOINT=http://localhost:8000 NOMBRE_TABLA=MisionEmprende-local \
 *   PROFESOR_ID=profesor-principal npx tsx scripts/migrarProfesorId.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  type ScanCommandOutput,
} from "@aws-sdk/lib-dynamodb";

const nombreTabla = process.env.NOMBRE_TABLA;
const profesorId = process.env.PROFESOR_ID;
const endpointLocal = process.env.DYNAMODB_ENDPOINT?.trim();

if (!nombreTabla) {
  console.error("ERROR: Variable NOMBRE_TABLA no definida.");
  process.exit(1);
}

if (!profesorId) {
  console.error("ERROR: Variable PROFESOR_ID no definida.");
  process.exit(1);
}

const clienteBase = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  ...(endpointLocal
    ? {
        endpoint: endpointLocal,
        credentials: { accessKeyId: "local", secretAccessKey: "local" },
      }
    : {}),
});

const cliente = DynamoDBDocumentClient.from(clienteBase, {
  marshallOptions: { removeUndefinedValues: true },
});

interface ItemSesion {
  PK: string;
  SK: string;
  correoProfesor?: string;
  profesorId?: string;
  GSI1SK?: string;
  fechaCreacion?: string;
  sesionId?: string;
}

async function buscarSesionesLegacy(): Promise<ItemSesion[]> {
  const sesiones: ItemSesion[] = [];
  let ultimaClave: Record<string, unknown> | undefined = undefined;

  do {
    const respuesta: ScanCommandOutput = await cliente.send(
      new ScanCommand({
        TableName: nombreTabla,
        FilterExpression:
          "SK = :sk AND attribute_not_exists(profesorId)",
        ExpressionAttributeValues: {
          ":sk": "METADATOS",
        },
        ExclusiveStartKey: ultimaClave,
      }),
    );

    for (const item of respuesta.Items ?? []) {
      if (String(item["tipo"] ?? "") === "SESION") {
        sesiones.push(item as ItemSesion);
      }
    }

    ultimaClave = respuesta.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (ultimaClave);

  return sesiones;
}

async function migrarSesion(item: ItemSesion): Promise<void> {
  const correo = item.correoProfesor ?? "";
  const gsi1sk = item.GSI1SK ?? `SESION#${item.fechaCreacion ?? ""}#${item.sesionId ?? ""}`;
  const nuevaGsi1pk = `PROFESOR#${profesorId}`;

  await cliente.send(
    new UpdateCommand({
      TableName: nombreTabla,
      Key: { PK: item.PK, SK: item.SK },
      UpdateExpression:
        "SET profesorId = :pid, GSI1PK = :gpk, GSI1SK = :gsk",
      ConditionExpression: "attribute_not_exists(profesorId)",
      ExpressionAttributeValues: {
        ":pid": profesorId,
        ":gpk": nuevaGsi1pk,
        ":gsk": gsi1sk,
      },
    }),
  );

  console.log(
    `  ✓ ${item.PK}  correo=${correo || "(sin correo)"}  → GSI1PK=${nuevaGsi1pk}`,
  );
}

async function ejecutar(): Promise<void> {
  console.log(`Tabla:      ${nombreTabla}`);
  console.log(`ProfesorId: ${profesorId}`);
  console.log(`Endpoint:   ${endpointLocal ?? "AWS real"}`);
  console.log("─".repeat(60));
  console.log("Buscando sesiones sin profesorId...");

  const legacy = await buscarSesionesLegacy();

  if (legacy.length === 0) {
    console.log("No hay sesiones que migrar. Todo está actualizado.");
    return;
  }

  console.log(`Encontradas ${legacy.length} sesion(es) legacy. Migrando...`);

  let ok = 0;
  let omitidas = 0;

  for (const item of legacy) {
    try {
      await migrarSesion(item);
      ok += 1;
    } catch (error: unknown) {
      const nombre = (error as { name?: string }).name ?? "";
      if (nombre === "ConditionalCheckFailedException") {
        console.log(`  → ${item.PK} ya migrado (salteado)`);
        omitidas += 1;
      } else {
        console.error(`  ✗ Error en ${item.PK}:`, error);
        throw error;
      }
    }
  }

  console.log("─".repeat(60));
  console.log(`Migración completa: ${ok} actualizadas, ${omitidas} ya migradas.`);
}

ejecutar().catch((error: unknown) => {
  console.error("Migración fallida:", error);
  process.exitCode = 1;
});
