
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';

// ==================================================
// LERABOT - FASE 4.5
// AWS Lambda Node.js 24.x
//
// GET: Leer configuracion de DynamoDB
// PUT: Actualizar configuracion de prueba
// CORS: Localhost y Amplify autorizados
//
// Tabla: ledabot-config
// PK: SYS#GLOBAL
// SK: PROFILE
// ==================================================

// ---------- DynamoDB ----------

const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({}),
  {
    marshallOptions: {
      removeUndefinedValues: true
    }
  }
);

const CLAVE = {
  PK: 'SYS#GLOBAL',
  SK: 'PROFILE'
};

// ---------- Campos permitidos ----------

const CAMPOS_FEATURES = [
  'enableDynamoAudit',
  'enableDynamoConfig',
  'enableDynamoDB',
  'enableFuturesTrading',
  'enableNotifications',
  'enableSpotLifecyclePersistence',
  'enableSpotTrading'
];

const TIMEFRAMES = new Set([
  '1m', '5m', '15m', '30m',
  '1h', '2h', '4h', '1d', '1w'
]);

// ==================================================
// CORS
// ==================================================

function obtenerOrigen(event) {
  const headers = event?.headers ?? {};

  const entrada = Object.entries(headers)
    .find(([clave]) =>
      clave.toLowerCase() === 'origin'
    );

  return typeof entrada?.[1] === 'string'
    ? entrada[1]
    : '';
}

function obtenerOrigenesPermitidos() {
  return new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map(origen => origen.trim())
      .filter(Boolean)
  );
}

function encabezadosCors(event) {
  const origen = obtenerOrigen(event);
  const permitidos = obtenerOrigenesPermitidos();

  const headers = {
    'vary': 'Origin'
  };

  if (origen && permitidos.has(origen)) {
    headers['access-control-allow-origin'] = origen;
    headers['access-control-allow-methods'] =
      'GET,PUT,OPTIONS';
    headers['access-control-allow-headers'] =
      'Content-Type,Authorization';
  }

  return headers;
}

// ==================================================
// RESPUESTAS HTTP
// ==================================================

function responder(statusCode, datos, event) {
  return {
    statusCode,
    headers: {
      'content-type':
        'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...encabezadosCors(event)
    },
    body: JSON.stringify(datos)
  };
}

// ==================================================
// VALIDACIONES
// ==================================================

const objeto = valor =>
  valor !== null &&
  typeof valor === 'object' &&
  !Array.isArray(valor);

const entero = (valor, minimo, maximo) =>
  Number.isInteger(valor) &&
  valor >= minimo &&
  valor <= maximo;

const numero = (valor, minimo, maximo) =>
  typeof valor === 'number' &&
  Number.isFinite(valor) &&
  valor >= minimo &&
  valor <= maximo;

function clavesValidas(valor, permitidas) {
  return objeto(valor) &&
    Object.keys(valor)
      .every(clave => permitidas.includes(clave));
}

function clavesExactas(valor, permitidas) {
  return clavesValidas(valor, permitidas) &&
    permitidas.every(clave =>
      Object.hasOwn(valor, clave)
    );
}

function validarEndpoint(valor) {
  if (!clavesExactas(valor, [
    'baseUrl',
    'rateLimit',
    'timeout'
  ])) {
    return false;
  }

  if (
    typeof valor.baseUrl !== 'string' ||
    valor.baseUrl.length > 256
  ) {
    return false;
  }

  try {
    const url = new URL(valor.baseUrl);

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return (
    entero(valor.rateLimit, 1, 100000) &&
    entero(valor.timeout, 100, 60000)
  );
}

function validarConfiguracion(defaults, features) {
  // ---------- Features ----------

  if (!clavesExactas(
    features,
    CAMPOS_FEATURES
  )) {
    return false;
  }

  if (!CAMPOS_FEATURES.every(
    campo =>
      typeof features[campo] === 'boolean'
  )) {
    return false;
  }

  // ---------- Defaults ----------

  const camposDefaults = [
    'defaultFuturesRiskPercent',
    'enabledTimeframes',
    'exchanges',
    'logging',
    'maxBalancePercentPerTrade',
    'maxRetries',
    'minSignalQuality',
    'region',
    'stage'
  ];

  if (!clavesExactas(
    defaults,
    camposDefaults
  )) {
    return false;
  }

  // ---------- Riesgos ----------

  if (
    defaults.defaultFuturesRiskPercent !== null &&
    !numero(
      defaults.defaultFuturesRiskPercent,
      0,
      100
    )
  ) {
    return false;
  }

  if (
    !numero(
      defaults.maxBalancePercentPerTrade,
      0,
      100
    ) ||
    !entero(defaults.maxRetries, 0, 20) ||
    !numero(defaults.minSignalQuality, 0, 100)
  ) {
    return false;
  }

  // ---------- Entorno ----------

  if (defaults.region !== 'sa-east-1') {
    return false;
  }

  if (!['dev', 'prd', 'test']
    .includes(defaults.stage)) {
    return false;
  }

  // ---------- Timeframes ----------

  const frames = defaults.enabledTimeframes;

  if (!clavesExactas(
    frames,
    ['SPOT', 'FUTURES']
  )) {
    return false;
  }

  for (const tipo of ['SPOT', 'FUTURES']) {
    const lista = frames[tipo];

    if (
      !Array.isArray(lista) ||
      lista.length > TIMEFRAMES.size ||
      new Set(lista).size !== lista.length ||
      !lista.every(tf => TIMEFRAMES.has(tf))
    ) {
      return false;
    }
  }

  // ---------- Logging ----------

  const logging = defaults.logging;

  const camposLogging = [
    'enablePerformanceMetrics',
    'enableSummaryLogs',
    'level',
    'structured'
  ];

  if (!clavesExactas(
    logging,
    camposLogging
  )) {
    return false;
  }

  if (![
    'DEBUG',
    'INFO',
    'WARN',
    'ERROR'
  ].includes(logging.level)) {
    return false;
  }

  for (const campo of [
    'enablePerformanceMetrics',
    'enableSummaryLogs',
    'structured'
  ]) {
    if (typeof logging[campo] !== 'boolean') {
      return false;
    }
  }

  // ---------- Exchanges ----------

  const exchanges = defaults.exchanges;

  if (!clavesExactas(
    exchanges,
    ['binance', 'bingx']
  )) {
    return false;
  }

  return ['binance', 'bingx'].every(nombre => {
    const exchange = exchanges[nombre];

    return (
      clavesExactas(
        exchange,
        ['name', 'spot', 'futures']
      ) &&
      exchange.name === (
        nombre === 'binance'
          ? 'Binance'
          : 'BingX'
      ) &&
      validarEndpoint(exchange.spot) &&
      validarEndpoint(exchange.futures)
    );
  });
}

// ==================================================
// HANDLER
// ==================================================

export const handler = async (event = {}) => {
  const tabla = process.env.DYNAMODB_CONFIG_TABLE;

  if (!tabla) {
    return responder(500, {
      ok: false,
      error: 'DYNAMODB_CONFIG_TABLE no configurada'
    }, event);
  }

  const metodo =
    event.httpMethod ??
    event.requestContext?.http?.method ??
    'GET';

  // ---------- OPTIONS ----------

  if (metodo === 'OPTIONS') {
    return responder(200, {
      ok: true
    }, event);
  }

  // ---------- Metodo permitido ----------

  if (!['GET', 'PUT'].includes(metodo)) {
    return responder(405, {
      ok: false,
      error: 'Metodo no permitido'
    }, event);
  }

  // GET y PUT sin autenticacion para esta etapa de pruebas.
  // Mantener API Gateway con Authorization NONE en ambos metodos.
  // Las validaciones de contenido y el control de version siguen activos.

  try {
    // ==========================================
    // GET - LEER CONFIGURACION
    // ==========================================

    if (metodo === 'GET') {
      const resultado = await db.send(
        new GetCommand({
          TableName: tabla,
          Key: CLAVE,
          ConsistentRead: true
        })
      );

      if (!resultado.Item) {
        return responder(404, {
          ok: false,
          error: 'Configuracion no encontrada'
        }, event);
      }

      const {
        defaults,
        features,
        createdAt,
        updatedAt,
        version = 0
      } = resultado.Item;

      return responder(200, {
        ok: true,
        configuracion: {
          defaults,
          features,
          createdAt,
          updatedAt,
          version
        }
      }, event);
    }

    // ==========================================
    // PUT - VALIDAR Y GUARDAR
    // ==========================================

    let body;

    try {
      body = typeof event.body === 'string'
        ? JSON.parse(event.body)
        : event.body;
    } catch {
      return responder(400, {
        ok: false,
        error: 'JSON invalido'
      }, event);
    }

    if (
      !clavesExactas(body, [
        'defaults',
        'features',
        'version'
      ]) ||
      !entero(body.version, 0, 1000000000) ||
      !validarConfiguracion(
        body.defaults,
        body.features
      )
    ) {
      return responder(400, {
        ok: false,
        error: 'Configuracion no valida'
      }, event);
    }

    const fecha = new Date().toISOString();

    const resultado = await db.send(
      new UpdateCommand({
        TableName: tabla,

        Key: CLAVE,

        UpdateExpression: `
          SET #defaults = :defaults,
              #features = :features,
              #updated = :updated,
              #version = :next
        `,

        ConditionExpression: `
          attribute_exists(PK)
          AND attribute_exists(SK)
          AND (
            (
              attribute_not_exists(#version)
              AND :expected = :zero
            )
            OR #version = :expected
          )
        `,

        ExpressionAttributeNames: {
          '#defaults': 'defaults',
          '#features': 'features',
          '#updated': 'updatedAt',
          '#version': 'version'
        },

        ExpressionAttributeValues: {
          ':defaults': body.defaults,
          ':features': body.features,
          ':updated': fecha,
          ':expected': body.version,
          ':next': body.version + 1,
          ':zero': 0
        },

        ReturnValues: 'ALL_NEW'
      })
    );

    return responder(200, {
      ok: true,
      configuracion: resultado.Attributes
    }, event);

  } catch (error) {

    // ---------- Conflicto de version ----------

    if (
      error?.name ===
      'ConditionalCheckFailedException'
    ) {
      return responder(409, {
        ok: false,
        error:
          'Configuracion modificada. Recarga antes de guardar.'
      }, event);
    }

    // ---------- Error inesperado ----------

    console.error('Error DynamoDB:', {
      name: error?.name,
      message: error?.message
    });

    return responder(500, {
      ok: false,
      error: 'Error procesando configuracion'
    }, event);
  }
};