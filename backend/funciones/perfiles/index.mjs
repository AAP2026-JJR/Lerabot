import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// LERABOT F10.5: PERFIL UNICO / SIN LOOKUP (DEMO SIN AUTENTICACION). No utilizar con datos reales.
// F10_5_PERFIL_UNICO
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {marshallOptions:{removeUndefinedValues:true}});
const table = process.env.SUBSCRIBERS_TABLE || 'ledabot-subscribers';
const risks = new Set(['CONSERVATIVE','MODERATE','AGGRESSIVE']);
const origins=(process.env.CORS_ALLOWED_ORIGINS||'http://localhost:5173').split(',').map(s=>s.trim());
const str=x=>typeof x==='string'?x:'';
function reply(statusCode,payload,event) {
 const origin=Object.entries(event.headers||{}).find(([k])=>k.toLowerCase()==='origin')?.[1];
 return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})},body:JSON.stringify(payload)};
}
function projection(p){return {displayName:p.displayName||'',role:p.role||'SUBSCRIBER',status:p.status||'',subscriberId:p.subscriberId||null,riskProfileRequested:p.riskProfileRequested||'MODERATE', tradingPreferences:p.tradingPreferences||{},updatedAt:p.updatedAt||''}}
// Busca solamente registros PROFILE (incluye usuarios antiguos). No depende de EMAIL#LOOKUP.
// Demo pequena: Scan no escala y no puede garantizar unicidad en carreras concurrentes.
async function profilesSnapshot(){
 const items=[];let cursor;
 do {
  const r=await db.send(new ScanCommand({TableName:table,Limit:100,ExclusiveStartKey:cursor,
   ProjectionExpression:'PK,SK,contact,email,displayName,subscriberId,adminId,#role,#status,riskProfileRequested,tradingPreferences,updatedAt',
   ExpressionAttributeNames:{'#role':'role','#status':'status'}}));
  items.push(...(r.Items||[]).filter(p=>p.SK==='PROFILE'));
  cursor=r.LastEvaluatedKey;
 }while(cursor);
 return items;
}
async function byEmail(email){
 return (await profilesSnapshot()).find(p=>str(p.contact?.email||p.email).trim().toLowerCase()===email)||null;
}
function normalName(v){
 return v.trim().replace(/\s+/g,' ').split(' ').map(word=>word.split(/(-)/).map(part=>part==='-'?part:(part?part.charAt(0).toLocaleUpperCase('es')+part.slice(1).toLocaleLowerCase('es'):part)).join('')).join(' ');
}
function nextSubscriberId(profiles){
 const numbers=profiles.map(p=>/^SUB#sub_(\d+)$/i.exec(str(p.PK)))
  .filter(Boolean).map(m=>Number(m[1])).filter(Number.isSafeInteger);
 return (Math.max(0,...numbers)+1);
}


// F12: edicion de configuracion del suscriptor (DEMO); no activa ordenes ni guarda secretos.
const allowedTF = new Set(['5','15','60','120','240','D','W']);
const allowedEx = new Set(['bingx','binance','bybit','okx']);
function own(x){return x && typeof x==='object' && !Array.isArray(x)}
function validMarket(raw, previous){
 if(!own(raw)||typeof raw.enabled!=='boolean'||!own(raw.symbols))throw Error('CONFIG_INVALIDA');
 const entries=Object.entries(raw.symbols);
 if(entries.length>100)throw Error('CONFIG_INVALIDA');
 const old=own(previous)?previous:{};
 const oldSymbols=own(old.symbols)?old.symbols:{};
 const symbols={...oldSymbols};
 for(const [key,v] of entries){
  if(!/^[A-Z0-9]{2,20}(USDT|USDC)$/.test(key)||!own(v)||typeof v.enabled!=='boolean'||!risks.has(v.profile)||!Array.isArray(v.exchanges)||!Array.isArray(v.timeframes)||v.exchanges.length>4||v.timeframes.length>7)throw Error('CONFIG_INVALIDA');
  if(!v.exchanges.every(e=>typeof e==='string'&&allowedEx.has(e)))throw Error('CONFIG_INVALIDA');
  if(!v.timeframes.every(t=>typeof t==='string'&&allowedTF.has(t)))throw Error('CONFIG_INVALIDA');
  // Mantener overrides y demas campos de estrategias legadas sin aceptar override nuevo del navegador.
  const oldSymbol=own(oldSymbols[key])?oldSymbols[key]:{};
  symbols[key]={...oldSymbol,enabled:v.enabled,profile:v.profile,exchanges:[...new Set(v.exchanges)],timeframes:[...new Set(v.timeframes)]};
 }
 return {...old,enabled:raw.enabled,symbols};
}

export const handler=async(event={})=>{
 const method=event.httpMethod||event.requestContext?.http?.method||'GET';
 if(method==='OPTIONS')return reply(200,{ok:true},event);
 if(method!=='POST')return reply(405,{ok:false,error:'Metodo no permitido'},event);
 const path=str(event.path||event.rawPath).replace(/\/$/,'');
 let b;try{b=JSON.parse(event.body||'{}')}catch{return reply(400,{ok:false,error:'JSON invalido'},event)}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply(400,{ok:false,error:'Datos invalidos'},event);
 try {
  if(path.endsWith('/registro')) {
   const displayName=normalName(str(b.displayName)),email=str(b.email).trim().toLowerCase(),mobilePhone=str(b.mobilePhone).trim(),riskProfileRequested=str(b.riskProfileRequested||'MODERATE').toUpperCase();
   if(displayName.length<3||displayName.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||mobilePhone.length>25||!risks.has(riskProfileRequested))return reply(400,{ok:false,error:'Verifica nombre, correo, telefono y perfil de riesgo'},event);
   // Conserva un solo item por usuario; reintenta colisiones de PK con escritura condicional.
   for(let attempt=0;attempt<6;attempt++){
    const profiles=await profilesSnapshot();
    if(profiles.some(p=>str(p.contact?.email||p.email).trim().toLowerCase()===email))return reply(409,{ok:false,error:'Correo ya registrado'},event);
    const next=nextSubscriberId(profiles)+attempt;
    const subscriberId=`sub_${String(next).padStart(3,'0')}`,now=new Date().toISOString();
    const profile={PK:`SUB#${subscriberId}`,SK:'PROFILE',subscriberId,role:'SUBSCRIBER',status:'active',displayName,riskProfileRequested,contact:{email,mobilePhone,notifications:{enabled:false,channels:[]}},tradingPreferences:{spot:{enabled:false,symbols:{}},futures:{enabled:false,symbols:{}}},createdAt:now,updatedAt:now};
    try {
     await db.send(new TransactWriteCommand({TransactItems:[{Put:{TableName:table,Item:profile,ConditionExpression:'attribute_not_exists(PK)'}}]}));
     return reply(201,{ok:true,subscriberId,message:'Cuenta de prueba creada. Inicia sesion con tu correo.'},event);
    }catch(e){if(e.name==='TransactionCanceledException'||e.name==='ConditionalCheckFailedException')continue;throw e}
   }
   return reply(409,{ok:false,error:'No se pudo reservar el siguiente ID; intenta nuevamente'},event);
  }
  if(!path.endsWith('/consultar'))return reply(404,{ok:false,error:'Ruta no encontrada'},event);
  const email=str(b.email).trim().toLowerCase(),action=str(b.action||'consultar');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{ok:false,error:'Correo invalido'},event);
  const p=await byEmail(email);
  if(action==='consultar'||action==='profile'){
   if(!p)return reply(200,{ok:true,exists:false},event);
   return reply(200,{ok:true,exists:true,profile:projection(p)},event);
  }
  if(action==='updateTradingConfig'){
   // NO es autenticacion. Mantener la funcion en pruebas con datos ficticios, deshabilitada por defecto.
   if(process.env.LERABOT_DEV_PROFILE_WRITES!=='enabled'||process.env.LERABOT_DEV_TRADING_CONFIG_WRITES!=='enabled')return reply(403,{ok:false,error:'Edicion de configuracion demo desactivada en AWS'},event);
   if(!p||!str(p.PK).startsWith('SUB#')||(p.role&&p.role!=='SUBSCRIBER')||p.status!=='active'||!p.subscriberId||p.subscriberId!==str(b.subscriberId))return reply(403,{ok:false,error:'Perfil no disponible'},event);
   if(!str(b.expectedUpdatedAt)||str(b.expectedUpdatedAt)!==str(p.updatedAt))return reply(409,{ok:false,error:'El perfil cambio en AWS; actualiza y vuelve a revisar'},event);
   if(!risks.has(b.riskProfileRequested)||!own(b.tradingPreferences))return reply(400,{ok:false,error:'Preferencias invalidas'},event);
   let spot,futures;
   try{
    spot=validMarket(b.tradingPreferences.spot,p.tradingPreferences?.spot);
    futures=validMarket(b.tradingPreferences.futures,p.tradingPreferences?.futures);
   }catch{return reply(400,{ok:false,error:'Configuracion de mercados o monedas invalida'},event)}
   const current=own(p.tradingPreferences)?p.tradingPreferences:{};
   const updated={...current,spot,futures};
   const now=new Date().toISOString();
   await db.send(new UpdateCommand({
    TableName:table,Key:{PK:p.PK,SK:'PROFILE'},
    UpdateExpression:'SET tradingPreferences=:config,riskProfileRequested=:risk,updatedAt=:now',
    ConditionExpression:'attribute_exists(PK) AND subscriberId=:id AND (#role=:role OR attribute_not_exists(#role)) AND #status=:active AND updatedAt=:previous',
    ExpressionAttributeNames:{'#role':'role','#status':'status'},
    ExpressionAttributeValues:{':config':updated,':risk':b.riskProfileRequested,':now':now,':id':p.subscriberId,':role':'SUBSCRIBER',':active':'active',':previous':b.expectedUpdatedAt}
   }));
   return reply(200,{ok:true,updatedAt:now,message:'Preferencias guardadas para entorno demo'},event);
  }
  if(action==='updateRisk'){
   // Intencionalmente NO asegura identidad: modo demo, desactivado salvo opt-in AWS.
   if(process.env.LERABOT_DEV_PROFILE_WRITES!=='enabled')return reply(403,{ok:false,error:'Edicion demo desactivada en AWS'},event);
   const risk=str(b.riskProfileRequested).toUpperCase();
   if(!risks.has(risk))return reply(400,{ok:false,error:'Riesgo no valido'},event);
   if(!p||!str(p.PK).startsWith('SUB#')||(p.role&&p.role!=='SUBSCRIBER')||p.status!=='active'||!p.subscriberId||p.subscriberId!==str(b.subscriberId))return reply(403,{ok:false,error:'Perfil de suscriptor no disponible'},event);
   await db.send(new UpdateCommand({TableName:table,Key:{PK:p.PK,SK:'PROFILE'},UpdateExpression:'SET riskProfileRequested=:risk,updatedAt=:now,#role=if_not_exists(#role,:role)',ConditionExpression:'attribute_exists(PK) AND (#role=:role OR attribute_not_exists(#role)) AND #status=:active AND subscriberId=:id',ExpressionAttributeNames:{'#role':'role','#status':'status'},ExpressionAttributeValues:{':risk':risk,':now':new Date().toISOString(),':role':'SUBSCRIBER',':active':'active',':id':p.subscriberId}}));
   return reply(200,{ok:true,riskProfileRequested:risk,message:'Riesgo guardado en DynamoDB. Trading no fue activado.'},event);
  }
  return reply(400,{ok:false,error:'Accion desconocida'},event);
 }catch(e){if(e.name==='TransactionCanceledException'||e.name==='ConditionalCheckFailedException')return reply(409,{ok:false,error:'Conflicto o cuenta duplicada'},event);console.error('perfiles',e.name);return reply(500,{ok:false,error:'No se pudo completar la operacion'},event)}
};
