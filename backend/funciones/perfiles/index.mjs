import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
const db=DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}});
const table=process.env.SUBSCRIBERS_TABLE||'ledabot-subscribers';
const origins=(process.env.CORS_ALLOWED_ORIGINS||'http://localhost:5173').split(',').map(v=>v.trim());
function reply(code,payload,event){const origin=Object.entries(event.headers||{}).find(([k])=>k.toLowerCase()==='origin')?.[1];return {statusCode:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})},body:JSON.stringify(payload)};}
export const handler=async(event={})=>{
 const method=event.httpMethod||event.requestContext?.http?.method||'GET';
 if(method==='OPTIONS')return reply(200,{ok:true},event);
 if(method!=='POST')return reply(405,{ok:false,error:'Metodo no permitido'},event);
 const path=(event.path||event.rawPath||'').replace(/\/$/,'');
 if(!path.endsWith('/registro'))return reply(404,{ok:false,error:'Ruta no encontrada'},event);
 let b;try{b=JSON.parse(event.body||'{}')}catch{return reply(400,{ok:false,error:'JSON invalido'},event)}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply(400,{ok:false,error:'Datos invalidos'},event);
 const nombre=String(b.displayName||'').trim(),email=String(b.email||'').trim().toLowerCase();
 const phone=String(b.mobilePhone||'').trim();
 if(nombre.length<3||nombre.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||phone.length>25)return reply(400,{ok:false,error:'Verifica nombre, correo y telefono'},event);
 // No aceptar role, PK, subscriberId ni preferencias desde el cliente.
 try{
  // Compatibilidad con perfiles legados sin EMAIL#...: verificar antes de crear.
  let start;do{const r=await db.send(new ScanCommand({TableName:table,ProjectionExpression:'PK,SK,contact,email',ExclusiveStartKey:start,Limit:100}));
   if((r.Items||[]).some(x=>String(x?.contact?.email||x?.email||'').toLowerCase()===email))return reply(409,{ok:false,error:'Correo ya registrado'},event);
   start=r.LastEvaluatedKey;
  }while(start);
  const id='sub-'+randomUUID().slice(0,12),now=new Date().toISOString();
  const profile={PK:`SUB#${id}`,SK:'PROFILE',subscriberId:id,role:'SUBSCRIBER',status:'pending_verification',displayName:nombre,contact:{email,mobilePhone:phone,notifications:{enabled:false,channels:[]}},tradingPreferences:{spot:{enabled:false,symbols:{}},futures:{enabled:false,symbols:{}}},createdAt:now,updatedAt:now};
  await db.send(new TransactWriteCommand({TransactItems:[{Put:{TableName:table,Item:profile,ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}},{Put:{TableName:table,Item:{PK:`EMAIL#${email}`,SK:'LOOKUP',subscriberId:id,role:'SUBSCRIBER',createdAt:now},ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}}]}));
  return reply(201,{ok:true,subscriberId:id,message:'Registro recibido. Pendiente de verificacion de correo.'},event);
 }catch(err){if(err.name==='TransactionCanceledException'||err.name==='ConditionalCheckFailedException')return reply(409,{ok:false,error:'Correo ya registrado'} ,event);console.error('Error alta perfil',err?.name);return reply(500,{ok:false,error:'No se pudo completar el registro'},event)}
};
