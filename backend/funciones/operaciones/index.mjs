import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {marshallOptions:{removeUndefinedValues:true}})
const LIMIT_MAX=100
function cors(event) {
  const origin = Object.entries(event.headers || {}).find(([k]) => k.toLowerCase()==='origin')?.[1]
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(x=>x.trim())
  return { 'vary':'Origin', ...(allowed.includes(origin) ? {'access-control-allow-origin': origin, 'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'Content-Type'} : {}) }
}
function response(code, content, event) {return {statusCode:code,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...cors(event)},body:JSON.stringify(content)}}
function parseCursor(cursor) {if(!cursor) return undefined; try {const value=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')); if(typeof value.PK==='string'&&typeof value.SK==='string') return {PK:value.PK,SK:value.SK}}catch{} throw Error('CURSOR_INVALIDO')}
function nextCursor(key) {return key ? Buffer.from(JSON.stringify(key)).toString('base64url') : null}
const txt = v => typeof v==='string'?v:''
const isBuy = x => txt(x.side).toUpperCase()==='BUY'
function totalRegistro(x) {const p=Number(x.buyPrice),q=Number(x.quantity);return Number.isFinite(p)&&Number.isFinite(q)&&p>0&&q>0?p*q:0}
async function scanAll(table,max=2000) {
  let last;const items=[];let scanned=0
  do {
    const r=await db.send(new ScanCommand({TableName:table,Limit:Math.min(200,max-scanned),ExclusiveStartKey:last}))
    items.push(...(r.Items||[]));scanned+=r.ScannedCount||0;last=r.LastEvaluatedKey
  } while(last && scanned<max)
  return {items,scanned,parcial:!!last}
}
export const handler = async (event={}) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET'
  if(method==='OPTIONS') return response(200,{ok:true},event)
  if(method!=='GET') return response(405,{ok:false,error:'Metodo no permitido'},event)
  const table=process.env.DYNAMODB_OPERATIONS_TABLE
  if(!table) return response(500,{ok:false,error:'DYNAMODB_OPERATIONS_TABLE no configurada'},event)
  const path=(event.path||event.rawPath||'').replace(/\/$/,'')
  const qs=event.queryStringParameters||{}
  try {
    if(path.endsWith('/detalle')) {
      if(!txt(qs.pk)||!txt(qs.sk)) return response(400,{ok:false,error:'Se requiere pk y sk'},event)
      const r=await db.send(new GetCommand({TableName:table,Key:{PK:qs.pk,SK:qs.sk},ConsistentRead:true}))
      return r.Item?response(200,{ok:true,operacion:r.Item},event):response(404,{ok:false,error:'Operacion no encontrada'},event)
    }
    if(path.endsWith('/resumen')) {
      const {items,scanned,parcial}=await scanAll(table,2000)
      const porSimbolo={}, porEstado={};const ids=new Set();let compras=0,ventas=0,otros=0,volumenComprasUsd=0
      for(const x of items) {
        const side=txt(x.side).toUpperCase();if(side==='BUY') {compras++;volumenComprasUsd+=totalRegistro(x)} else if(side==='SELL') ventas++;else otros++
        const sub = /^SUB#([^#]+)/.exec(txt(x.PK))?.[1];if(sub)ids.add(sub)
        const symbol=txt(x.symbol)||'SIN_SIMBOLO',status=txt(x.status)||'SIN_ESTADO'
        porSimbolo[symbol]=(porSimbolo[symbol]||0)+totalRegistro(x)
        porEstado[status]=(porEstado[status]||0)+1
      }
      return response(200,{ok:true,total:items.length,compras,ventas,otros,suscriptores:ids.size,volumenComprasUsd,porSimbolo,porEstado,parcial,examinados:scanned},event)
    }
    const limit=Math.min(LIMIT_MAX,Math.max(1,Number.parseInt(qs.limite||'30',10)||30))
    let cursor
    try {cursor=parseCursor(qs.cursor)}catch {return response(400,{ok:false,error:'Cursor invalido'},event)}
    // FilterExpression reduce los items devueltos, no garantiza un llenado de pagina.
    // Scan paginado se conserva, no se afirma orden cronologico global.
    const conditions=[],names={},values={}
    if(qs.suscriptor) {conditions.push('begins_with(#pk, :sub)'); names['#pk']='PK';values[':sub']=`SUB#${qs.suscriptor}#`}
    if(qs.estado) {conditions.push('#status = :estado'); names['#status']='status';values[':estado']=qs.estado}
    if(qs.exchange) {conditions.push('#exchange = :exchange');names['#exchange']='exchangeId';values[':exchange']=qs.exchange}
    if(qs.simbolo) {conditions.push('#symbol = :simbolo');names['#symbol']='symbol';values[':simbolo']=qs.simbolo}
    const result=await db.send(new ScanCommand({TableName:table,Limit:limit,ExclusiveStartKey:cursor,...(conditions.length?{FilterExpression:conditions.join(' AND '),ExpressionAttributeNames:names,ExpressionAttributeValues:values}:{})}))
    return response(200,{ok:true,operaciones:result.Items||[],siguienteCursor:nextCursor(result.LastEvaluatedKey),examinados:result.ScannedCount||0,parcial:!!result.LastEvaluatedKey},event)
  } catch(err) {console.error('Operacion consulta error:',err?.name,err?.message);return response(500,{ok:false,error:'Error consultando operaciones'},event)}
}
