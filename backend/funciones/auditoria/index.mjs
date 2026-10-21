import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tabla = () => process.env.DYNAMODB_AUDIT_TABLE;
const limiteNum = (v, d = 30, max = 100) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? Math.min(n,max) : d };
function cors(event) {
  const origen = Object.entries(event.headers ?? {}).find(([k]) => k.toLowerCase()==='origin')?.[1];
  const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map(v=>v.trim());
  return origen && allowed.includes(origen) ? { 'access-control-allow-origin': origen, 'access-control-allow-methods':'GET,OPTIONS', 'access-control-allow-headers':'Content-Type', 'vary':'Origin' } : {vary:'Origin'};
}
const responder=(statusCode,body,event)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...cors(event)},body:JSON.stringify(body)});
function cursorDecode(v) { if(!v) return undefined; try { const o=JSON.parse(Buffer.from(v,'base64url').toString('utf8')); if(o && typeof o.PK==='string' && typeof o.SK==='string') return {PK:o.PK,SK:o.SK}; }catch{} throw Object.assign(new Error('Cursor invalido'),{http:400}); }
const cursorEncode=v=>v?Buffer.from(JSON.stringify({PK:v.PK,SK:v.SK})).toString('base64url'):null;
function coincide(e,q) {
  for (const [campo,clave] of [['status','estado'],['source','fuente'],['symbol','simbolo'],['tradeType','tipo']]) { if(q[clave] && String(e[campo]??'').toLowerCase() !== String(q[clave]).toLowerCase()) return false; }
  if(q.buscar){const needle=String(q.buscar).toLowerCase();if(!['operationId','signalId','eventId','message','PK'].some(k=>String(e[k]??'').toLowerCase().includes(needle)))return false;}
  return true;
}
async function pagina(eventosLimite,cursor,q) {
  let exclusive=cursor, scanned=0; const eventos=[]; let pages=0;
  while(eventos.length<eventosLimite && pages<6) {
    const r=await db.send(new ScanCommand({TableName:tabla(),Limit:Math.max(25,Math.min(100,eventosLimite*2)),ExclusiveStartKey:exclusive}));
    scanned+=(r.ScannedCount??0); pages++;
    for(const e of (r.Items??[])) if(coincide(e,q)) eventos.push(e);
    exclusive=r.LastEvaluatedKey;
    if(!exclusive)break;
  }
  // Cursor points to the last scanned key. We return every match from scanned batches
  // to avoid silently discarding matches when batches exceed requested page size.
  return {ok:true,eventos,siguienteCursor:cursorEncode(exclusive),examinados:scanned,parcial:!!exclusive};
}
async function resumen(){
  let key, scanned=0, pages=0, ultimoEvento=null; const porEstado={},porFuente={}; let total=0;
  do { const r=await db.send(new ScanCommand({TableName:tabla(),Limit:200,ExclusiveStartKey:key}));
    for(const e of r.Items??[]){total++;const s=String(e.status??'SIN_ESTADO');const f=String(e.source??'SIN_FUENTE');porEstado[s]=(porEstado[s]??0)+1;porFuente[f]=(porFuente[f]??0)+1;if(e.createdAt && (!ultimoEvento || e.createdAt>ultimoEvento))ultimoEvento=e.createdAt;}
    scanned+=r.ScannedCount??0;key=r.LastEvaluatedKey;pages++;
  }while(key && pages<10);
  return {ok:true,total,porEstado,porFuente,ultimoEvento,examinados:scanned,parcial:!!key};
}
export const handler=async(event={})=>{
  const method=event.httpMethod??event.requestContext?.http?.method??'GET';
  if(method==='OPTIONS')return responder(200,{ok:true},event);
  if(method!=='GET')return responder(405,{ok:false,error:'Metodo no permitido'},event);
  if(!tabla())return responder(500,{ok:false,error:'DYNAMODB_AUDIT_TABLE no configurada'},event);
  const path=event.path??event.rawPath??'';const q=event.queryStringParameters??{};
  try{
    if(path.endsWith('/resumen')) return responder(200,await resumen(),event);
    if(path.endsWith('/detalle') || (event.pathParameters?.eventId)){
      // DynamoDB composite key is unambiguous. eventId alone is not a primary key.
      if(!q.pk||!q.sk)return responder(400,{ok:false,error:'Se necesitan pk y sk'},event);
      const r=await db.send(new GetCommand({TableName:tabla(),Key:{PK:q.pk,SK:q.sk}}));
      return r.Item?responder(200,{ok:true,evento:r.Item},event):responder(404,{ok:false,error:'Evento no encontrado'},event);
    }
    return responder(200,await pagina(limiteNum(q.limite),cursorDecode(q.cursor),q),event);
  }catch(e){console.error('Auditoria error',e?.name,e?.message);return responder(e?.http??500,{ok:false,error:e?.http?'Cursor invalido':'Error consultando auditoria'},event);}
};
