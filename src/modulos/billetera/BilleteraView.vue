<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { listarOperaciones } from '@/modulos/operaciones/servicio'
import { sesionDemo } from '@/modulos/login/sesionDemo'
import type { OperacionSpot } from '@/modulos/operaciones/tipos'

type Tab = 'cuentas' | 'activos' | 'movimientos'
type Tipo = 'DEPOSITO' | 'RETIRO' | 'TRANSFERENCIA' | 'COMPRA' | 'VENTA' | 'COMISION'
type Cuenta = { id: string; exchange: string; nombre: string; walletType?: string }
type Movimiento = { id: string; tipo: Tipo; fecha: string; origen: string; destino?: string; activo: string; cantidad: number; precio?: number; nota: string }
const sesion = sesionDemo()
const esAdmin = sesion?.rol === 'ADMIN'
const propietario = sesion?.subscriberId || 'admin-demo'
const clave = `ledabot_f17_simulador_${propietario}`
const tab = ref<Tab>('cuentas')
const cuentas = ref<Cuenta[]>([])
const movimientos = ref<Movimiento[]>([])
const operacionesAWS = ref<OperacionSpot[]>([])
const parcialAWS = ref(false)
const cargando = ref(false)
const errorAWS = ref('')
const errorForm = ref('')
const filtroExchange = ref('TODOS')
const filtroCuenta = ref('TODAS')
const filtroSuscriptor = ref('TODOS')
const mostrarFormulario = ref(false)
const mostrarCuenta = ref(false)
const nuevaCuenta = ref({ exchange: 'BingX', nombre: '', walletType: 'Spot' })
const form = ref({ tipo: 'DEPOSITO' as Tipo, origen: '', destino: '', activo: 'USDT', cantidad: '', precio: '', nota: '' })
const usd = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n)
const numero = (n: number) => new Intl.NumberFormat('es-PE',{maximumFractionDigits:8}).format(n)
const idSuscriptor = (o: OperacionSpot) => /^SUB#([^#]+)/i.exec(o.PK || '')?.[1]?.toLowerCase() || ''
const fecha = (v: string) => { const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString('es-PE') }
const nombreCuenta = (id: string) => { const c=cuentas.value.find(x=>x.id===id);return c?`${c.exchange} · ${c.nombre}`:id }
const exchangeCuenta = (id: string) => cuentas.value.find(x=>x.id===id)?.exchange || 'Otro'
const tipos: Record<Tipo,string> = { DEPOSITO:'Depósito',RETIRO:'Retiro',TRANSFERENCIA:'Transferencia',COMPRA:'Compra',VENTA:'Venta',COMISION:'Comisión' }
const normalActivo = (v: string) => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15)
const opcionesExchanges = computed(() => [...new Set([...cuentas.value.map(c=>c.exchange),...operacionesAWS.value.map(o=>String(o.exchangeId || '').trim()).filter(Boolean)])].sort())
const disponibles = computed(() => cuentas.value.filter(c=>filtroExchange.value==='TODOS'||c.exchange.toLowerCase()===filtroExchange.value.toLowerCase()))
const operacionesPorRol = computed(() => operacionesAWS.value.filter(o => esAdmin ? (filtroSuscriptor.value==='TODOS'||idSuscriptor(o)===filtroSuscriptor.value) : idSuscriptor(o)===String(sesion?.subscriberId||'').toLowerCase()))
const suscriptoresAWS = computed(() => [...new Set(operacionesAWS.value.map(idSuscriptor).filter(Boolean))].sort())
const operacionesFiltradas = computed(() => operacionesPorRol.value.filter(o=>{
 const ex=String(o.exchangeId||'').toLowerCase()
 if(filtroExchange.value!=='TODOS'&&ex!==filtroExchange.value.toLowerCase())return false
 if(filtroCuenta.value!=='TODAS'){
  // La API de operaciones puede no tener accountId: no adivinar su cuenta.
  const c=String(o.accountId??o.account_id??'')
  if(!c||c!==filtroCuenta.value)return false
 }
 return true
}))
const comprasAWS = computed(() => operacionesFiltradas.value.filter(o=>String(o.side||'').toUpperCase()==='BUY'))
const invertidoAWS = computed(() => comprasAWS.value.reduce((s,o)=>{const p=Number(o.buyPrice),q=Number(o.quantity);return s+(Number.isFinite(p)&&p>0&&Number.isFinite(q)&&q>0?p*q:0)},0))
const movimientosFiltrados = computed(() => movimientos.value.filter(m=>{
 if(filtroExchange.value!=='TODOS'&&exchangeCuenta(m.origen).toLowerCase()!==filtroExchange.value.toLowerCase()&&exchangeCuenta(m.destino||'').toLowerCase()!==filtroExchange.value.toLowerCase())return false
 if(filtroCuenta.value!=='TODAS'&&m.origen!==filtroCuenta.value&&m.destino!==filtroCuenta.value)return false
 return true
}).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)))
// Libro simulado: cada evento aplica débitos/créditos, sin mezclarlo con las compras AWS.
const ledger = computed(() => {
 const saldos: Record<string,Record<string,number>>={}
 for(const c of cuentas.value)saldos[c.id]={}
 const add=(id:string,asset:string,value:number)=>{if(!saldos[id])saldos[id]={};saldos[id][asset]=(saldos[id][asset]||0)+value}
 for(const m of movimientos.value){
  if(m.tipo==='DEPOSITO')add(m.origen,m.activo,m.cantidad)
  if(m.tipo==='RETIRO'||m.tipo==='COMISION')add(m.origen,m.activo,-m.cantidad)
  if(m.tipo==='TRANSFERENCIA'&&m.destino){add(m.origen,m.activo,-m.cantidad);add(m.destino,m.activo,m.cantidad)}
  if(m.tipo==='COMPRA'&&m.precio){add(m.origen,'USDT',-m.cantidad*m.precio);add(m.origen,m.activo,m.cantidad)}
  if(m.tipo==='VENTA'&&m.precio){add(m.origen,m.activo,-m.cantidad);add(m.origen,'USDT',m.cantidad*m.precio)}
 }
 return saldos
})
const totalUSDT = computed(() => Object.entries(ledger.value).reduce((s,[id,saldos])=>s+((filtroExchange.value==='TODOS'||exchangeCuenta(id).toLowerCase()===filtroExchange.value.toLowerCase())&&(filtroCuenta.value==='TODAS'||id===filtroCuenta.value)?saldos.USDT||0:0),0))
const activosSimulados = computed(() => {const a:Record<string,number>={};for(const [id,saldos] of Object.entries(ledger.value)){
 if(filtroCuenta.value!=='TODAS'&&id!==filtroCuenta.value)continue
 if(filtroExchange.value!=='TODOS'&&exchangeCuenta(id).toLowerCase()!==filtroExchange.value.toLowerCase())continue
 for(const [asset,cantidad] of Object.entries(saldos))a[asset]=(a[asset]||0)+cantidad
 }return Object.entries(a).filter(([,q])=>Math.abs(q)>1e-8).sort((a,b)=>a[0].localeCompare(b[0]))})
const cuentasFiltradas = computed(() => disponibles.value.filter(c=>filtroCuenta.value==='TODAS'||c.id===filtroCuenta.value))
// F17.1: escenario 100 % ficticio. Solo se inicializa cuando el usuario no tiene datos locales.
const PRECIOS_DEMO: Record<string,number> = {BTC: 45000, ETH: 2600, SOL: 140, XRP: 1.10, USDT: 1}
const saldoValorizado = computed(() => activosSimulados.value.reduce((s,[activo,q]) => s+q*(PRECIOS_DEMO[activo]||0),0))
const cuentasConValor = computed(() => cuentasFiltradas.value.map(c=>({
  ...c,
  saldoUSDT:saldoDe(c.id,'USDT'),
  inversion: Object.entries(ledger.value[c.id]||{}).filter(([a])=>a!=='USDT').reduce((s,[a,q])=>s+q*(PRECIOS_DEMO[a]||0),0)
})))
const totalComprasDemo = computed(() => movimientosFiltrados.value.filter(m=>m.tipo==='COMPRA').reduce((s,m)=>s+m.cantidad*(m.precio||0),0))
const totalDepositosDemo = computed(() => movimientosFiltrados.value.filter(m=>m.tipo==='DEPOSITO'&&m.activo==='USDT').reduce((s,m)=>s+m.cantidad,0))
const totalRetirosDemo = computed(() => movimientosFiltrados.value.filter(m=>m.tipo==='RETIRO'&&m.activo==='USDT').reduce((s,m)=>s+m.cantidad,0))
const actividadDemo = computed(() => [...movimientosFiltrados.value].slice(0,6))
const rankingActivosDemo = computed(() => activosSimulados.value.map(([activo,cantidad]) => ({activo,cantidad,valor:cantidad*(PRECIOS_DEMO[activo]||0)})).sort((a,b)=>b.valor-a.valor))
function cargarEscenarioDemo(forzar=false){
  errorForm.value=''
  if(!forzar&&(cuentas.value.length>0||movimientos.value.length>0))return
  if(forzar&&!confirm('¿Reemplazar las cuentas y movimientos LOCALES por el ejemplo F17.1? No altera AWS.'))return
  const ids=['demo_bingx_principal','demo_bingx_secundaria','demo_binance_spot','demo_tangem'] as const
  cuentas.value=[
    {id:ids[0],exchange:'BingX',nombre:'Principal',walletType:'Spot'},
    {id:ids[1],exchange:'BingX',nombre:'Secundaria',walletType:'Fondos'},
    {id:ids[2],exchange:'Binance',nombre:'Spot',walletType:'Spot'},
    {id:ids[3],exchange:'Tangem',nombre:'Billetera fría',walletType:'Externa'}
  ]
  const eventos: Array<{tipo:Tipo;origen:string;destino?:string;activo:string;cantidad:number;precio?:number;nota:string}>=[
    {tipo:'DEPOSITO',origen:ids[0],activo:'USDT',cantidad:8000,nota:'Depósito bancario de prueba'},
    {tipo:'DEPOSITO',origen:ids[1],activo:'USDT',cantidad:3500,nota:'Ingreso de fondos de prueba'},
    {tipo:'DEPOSITO',origen:ids[2],activo:'USDT',cantidad:4200,nota:'Depósito de ejemplo'},
    {tipo:'DEPOSITO',origen:ids[3],activo:'USDT',cantidad:1000,nota:'Saldo inicial ficticio'},
    {tipo:'TRANSFERENCIA',origen:ids[0],destino:ids[1],activo:'USDT',cantidad:1500,nota:'Traspaso interno: no es ingreso'},
    {tipo:'COMPRA',origen:ids[0],activo:'BTC',cantidad:0.05,precio:42000,nota:'Compra Spot BTC de ejemplo'},
    {tipo:'COMPRA',origen:ids[0],activo:'ETH',cantidad:1.2,precio:2500,nota:'Compra Spot ETH de ejemplo'},
    {tipo:'COMPRA',origen:ids[1],activo:'SOL',cantidad:10,precio:120,nota:'Compra Spot SOL de ejemplo'},
    {tipo:'COMPRA',origen:ids[1],activo:'BTC',cantidad:0.025,precio:44000,nota:'Acumulación BTC de ejemplo'},
    {tipo:'COMPRA',origen:ids[2],activo:'ETH',cantidad:0.8,precio:2600,nota:'Compra ETH en Binance'},
    {tipo:'COMPRA',origen:ids[2],activo:'SOL',cantidad:6,precio:125,nota:'Compra SOL en Binance'},
    {tipo:'TRANSFERENCIA',origen:ids[3],destino:ids[2],activo:'USDT',cantidad:300,nota:'Movimiento entre cuentas propias'},
    {tipo:'VENTA',origen:ids[2],activo:'SOL',cantidad:2,precio:150,nota:'Venta parcial SOL'},
    {tipo:'VENTA',origen:ids[0],activo:'ETH',cantidad:0.2,precio:2700,nota:'Venta parcial ETH'},
    {tipo:'RETIRO',origen:ids[0],activo:'USDT',cantidad:250,nota:'Retiro ficticio'},
    {tipo:'TRANSFERENCIA',origen:ids[1],destino:ids[2],activo:'USDT',cantidad:400,nota:'Transferencia propia de prueba'},
    {tipo:'RETIRO',origen:ids[1],activo:'USDT',cantidad:150,nota:'Retiro de prueba'},
    {tipo:'COMISION',origen:ids[0],activo:'USDT',cantidad:2.50,nota:'Comisión de compra de ejemplo'},
    {tipo:'COMISION',origen:ids[2],activo:'USDT',cantidad:1.15,nota:'Comisión de venta de ejemplo'}
  ]
  movimientos.value=eventos.map((m,i)=>({id:`demo_f171_${i+1}`,fecha:new Date(Date.now()-(eventos.length-i)*86400000).toISOString(),...m}))
  filtroExchange.value='TODOS';filtroCuenta.value='TODAS';tab.value='cuentas';
  form.value={tipo:'DEPOSITO',origen:ids[0],destino:'',activo:'USDT',cantidad:'',precio:'',nota:''}
  guardarLocal()
}
function guardarLocal(){try{localStorage.setItem(clave,JSON.stringify({version:1,cuentas:cuentas.value,movimientos:movimientos.value}))}catch{errorForm.value='No se pudo guardar el simulador en este navegador.'}}
function cargarLocal(){try{const raw=localStorage.getItem(clave);if(!raw)return;const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=='object')return;const p=parsed as Record<string,unknown>;
 if(Array.isArray(p.cuentas))cuentas.value=p.cuentas.filter((x:unknown):x is Cuenta=>!!x&&typeof x==='object'&&typeof (x as Cuenta).id==='string'&&typeof (x as Cuenta).exchange==='string'&&typeof (x as Cuenta).nombre==='string').slice(0,100)
 if(Array.isArray(p.movimientos))movimientos.value=p.movimientos.filter((x:unknown):x is Movimiento=>!!x&&typeof x==='object'&&typeof (x as Movimiento).id==='string'&&typeof (x as Movimiento).cantidad==='number').slice(0,5000)
}catch{errorForm.value='No fue posible leer los datos del simulador.'}}
watch([cuentas,movimientos],()=>guardarLocal(),{deep:true})
function crearCuenta(){errorForm.value='';const nombre=nuevaCuenta.value.nombre.trim().slice(0,60);if(!nombre){errorForm.value='Escribe el nombre de la cuenta.';return}
 const id=`local_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;cuentas.value.push({id,exchange:nuevaCuenta.value.exchange,nombre,walletType:nuevaCuenta.value.walletType});nuevaCuenta.value.nombre='';form.value.origen=id;mostrarCuenta.value=false}
const saldoDe = (id:string,asset:string)=>ledger.value[id]?.[asset]||0
function registrar(){errorForm.value='';const m=form.value;const cantidad=Number(m.cantidad),precio=Number(m.precio);const activo=normalActivo(m.activo)
 if(!cuentas.value.some(c=>c.id===m.origen)){errorForm.value='Selecciona una cuenta de origen.';return}
 if(!Number.isFinite(cantidad)||cantidad<=0||cantidad>1e12){errorForm.value='Cantidad inválida.';return}
 if(!activo){errorForm.value='Selecciona un activo.';return}
 if((m.tipo==='COMPRA'||m.tipo==='VENTA')&&(activo==='USDT'||!Number.isFinite(precio)||precio<=0||precio>1e12)){errorForm.value='Para comprar o vender selecciona un activo distinto de USDT y un precio USDT válido.';return}
 if(m.tipo==='TRANSFERENCIA'&&(!m.destino||m.origen===m.destino||!cuentas.value.some(c=>c.id===m.destino))){errorForm.value='Selecciona otra cuenta de destino.';return}
 const debit=m.tipo==='COMPRA'?cantidad*precio:cantidad;const debitAsset=m.tipo==='COMPRA'?'USDT':activo
 if(m.tipo!=='DEPOSITO'&&saldoDe(m.origen,debitAsset)+1e-8<debit){errorForm.value=`Saldo simulado insuficiente: ${numero(saldoDe(m.origen,debitAsset))} ${debitAsset}. Registra primero un depósito simulado.`;return}
 movimientos.value.push({id:`mov_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,tipo:m.tipo,fecha:new Date().toISOString(),origen:m.origen,...(m.tipo==='TRANSFERENCIA'?{destino:m.destino}:{}),activo,cantidad,...(['COMPRA','VENTA'].includes(m.tipo)?{precio}:{}),nota:m.nota.slice(0,160)})
 mostrarFormulario.value=false;form.value={...m,cantidad:'',precio:'',nota:''}
}
function borrarSimulacion(){if(!confirm('¿Eliminar todos los movimientos y cuentas SIMULADOS de este navegador? No afecta AWS ni DynamoDB.'))return;movimientos.value=[];cuentas.value=[];filtroCuenta.value='TODAS';guardarLocal()}
async function cargarAWS(){cargando.value=true;errorAWS.value='';try{const filas:OperacionSpot[]=[];let cursor='';parcialAWS.value=false
 for(let i=0;i<20;i++){const r=await listarOperaciones({limite:'100',...(cursor?{cursor}:{})});filas.push(...(r.operaciones||[]));if(!r.siguienteCursor)break;cursor=r.siguienteCursor;if(i===19)parcialAWS.value=true}
 operacionesAWS.value=filas
}catch(e){errorAWS.value=e instanceof Error?e.message:'Error consultando operaciones AWS'}finally{cargando.value=false}}
onMounted(()=>{cargarLocal();cargarEscenarioDemo();void cargarAWS()})

// F17.2: vista transaccional, sin KPI ni gráficas. Movimientos solo del libro local.
const cuentaSeleccionada = ref('TODAS')
const tipoMovimiento = ref('TODOS')
const busqueda = ref('')
const detalleId = ref('')
const movimientosPagina = ref(1)
const porPagina = 12
const cuentasVisibles = computed(() => cuentasFiltradas.value)
const cuentasConDetalle = computed(() => cuentasVisibles.value.map(c => {
 const saldos = Object.entries(ledger.value[c.id] || {}).filter(([,q])=>Math.abs(q)>1e-8).sort(([a],[b])=>a==='USDT'?-1:b==='USDT'?1:a.localeCompare(b))
 return { ...c, saldos, usdt: saldoDe(c.id,'USDT'), operaciones: movimientos.value.filter(m=>m.origen===c.id||m.destino===c.id).length }
}))
const cuentaDetalle = computed(() => cuentas.value.find(c=>c.id===cuentaSeleccionada.value) || null)
const detalleSaldos = computed(() => cuentaDetalle.value ? Object.entries(ledger.value[cuentaDetalle.value.id] || {}).filter(([,q])=>Math.abs(q)>1e-8).sort(([a],[b])=>a==='USDT'?-1:b==='USDT'?1:a.localeCompare(b)) : activosSimulados.value)
const movimientosVista = computed(() => movimientosFiltrados.value.filter(m => {
 if(cuentaSeleccionada.value!=='TODAS' && m.origen!==cuentaSeleccionada.value && m.destino!==cuentaSeleccionada.value) return false
 if(tipoMovimiento.value!=='TODOS' && m.tipo!==tipoMovimiento.value) return false
 const q=busqueda.value.trim().toLowerCase()
 return !q || [m.activo,m.tipo,m.nota,nombreCuenta(m.origen),m.destino?nombreCuenta(m.destino):''].join(' ').toLowerCase().includes(q)
}))
const numeroPaginas = computed(()=>Math.max(1,Math.ceil(movimientosVista.value.length/porPagina)))
const movimientoPagina = computed(()=>movimientosVista.value.slice((movimientosPagina.value-1)*porPagina,movimientosPagina.value*porPagina))
watch([cuentaSeleccionada,tipoMovimiento,busqueda,filtroExchange,filtroCuenta],()=>{movimientosPagina.value=1})
watch([filtroExchange,filtroCuenta],()=>{ if(cuentaSeleccionada.value!=='TODAS' && !cuentasFiltradas.value.some(c=>c.id===cuentaSeleccionada.value)) cuentaSeleccionada.value='TODAS' })
const cuentaIcono = (nombre:string) => nombre.toLowerCase().includes('bingx') ? 'BX' : nombre.toLowerCase().includes('binance') ? 'BN' : nombre.toLowerCase().includes('tangem') ? 'TG' : nombre.substring(0,2).toUpperCase()
const movimientoSigno = (m:Movimiento) => m.tipo==='DEPOSITO'||m.tipo==='VENTA' ? '+' : m.tipo==='RETIRO'||m.tipo==='COMISION'||m.tipo==='COMPRA' ? '−' : '↔'
const movimientoColor = (m:Movimiento) => m.tipo==='DEPOSITO'||m.tipo==='VENTA' ? 'text-emerald-700 bg-emerald-50' : m.tipo==='RETIRO'||m.tipo==='COMISION' ? 'text-rose-700 bg-rose-50' : 'text-sky-700 bg-sky-50'
const detalleCambio = (m:Movimiento) => m.tipo==='COMPRA'||m.tipo==='VENTA' ? `${numero(m.cantidad*(m.precio||0))} USDT` : ''
function elegirCuenta(id:string){cuentaSeleccionada.value=id;tab.value='cuentas'}
function nuevaOperacion(tipo:Tipo,cuenta=''){form.value={tipo,origen:cuenta||(cuentaSeleccionada.value!=='TODAS'?cuentaSeleccionada.value:'')||cuentas.value[0]?.id||'',destino:'',activo:'USDT',cantidad:'',precio:'',nota:''};mostrarFormulario.value=true;tab.value='movimientos'}
function cambiarTab(t:Tab){tab.value=t;mostrarFormulario.value=false}
</script>
<template>
  <main class="mx-auto max-w-[1480px] space-y-4 px-3 py-4 text-[#112b38] sm:px-6 sm:py-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-700">LedaBot · Gestión de fondos</p>
        <h1 class="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Mi billetera</h1>
        <p class="mt-1 text-sm text-slate-500">Consulta tus cuentas, monedas y cada movimiento del dinero.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">DEMO · Saldos simulados</span>
        <button class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50" @click="cargarEscenarioDemo(true)">Restaurar ejemplo</button>
      </div>
    </header>
    <p class="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">Los saldos mostrados se derivan únicamente de movimientos de prueba guardados en este navegador. <strong>No son los balances reales de BingX, Binance ni Tangem.</strong> Las compras históricas consultadas en AWS permanecen separadas para evitar doble contabilización.</p>
    <p v-if="errorAWS" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{errorAWS}}</p>
    <p v-if="parcialAWS" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">La consulta AWS está paginada y puede ser parcial.</p>

    <section class="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <label class="min-w-[170px] flex-1 text-xs font-semibold text-slate-600">Exchange
        <select v-model="filtroExchange" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="TODOS">Todos los exchanges</option><option v-for="e in opcionesExchanges" :key="e" :value="e">{{e}}</option></select>
      </label>
      <label class="min-w-[170px] flex-1 text-xs font-semibold text-slate-600">Cuenta
        <select v-model="filtroCuenta" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="TODAS">Todas las cuentas</option><option v-for="c in disponibles" :key="c.id" :value="c.id">{{c.exchange}} · {{c.nombre}}</option></select>
      </label>
      <label v-if="esAdmin" class="min-w-[170px] flex-1 text-xs font-semibold text-slate-600">Suscriptor (compras AWS)
        <select v-model="filtroSuscriptor" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="TODOS">Todos · consulta demo</option><option v-for="id in suscriptoresAWS" :key="id" :value="id">{{id}}</option></select>
      </label>
      <button class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50" @click="filtroExchange='TODOS';filtroCuenta='TODAS';filtroSuscriptor='TODOS';cuentaSeleccionada='TODAS'">Limpiar</button>
    </section>

    <section class="grid gap-3 lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside class="space-y-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between gap-2"><h2 class="font-extrabold">Mis cuentas</h2><button class="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800" @click="mostrarCuenta=!mostrarCuenta">+ Cuenta</button></div>
          <p class="mt-1 text-xs text-slate-500">Selecciona una cuenta para ver sus fondos.</p>
          <button class="mt-4 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm" :class="cuentaSeleccionada==='TODAS'?'border-emerald-400 bg-emerald-50 font-bold':'border-slate-200'" @click="elegirCuenta('TODAS')"><span>◈ Todas las cuentas</span><span>{{cuentasFiltradas.length}}</span></button>
          <div class="mt-2 space-y-2">
            <button v-for="c in cuentasConDetalle" :key="c.id" class="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-emerald-300" :class="cuentaSeleccionada===c.id?'border-emerald-400 bg-emerald-50/80':'border-slate-200 bg-white'" @click="elegirCuenta(c.id)">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">{{cuentaIcono(c.exchange)}}</span>
              <span class="min-w-0 flex-1"><span class="block truncate text-sm font-bold">{{c.exchange}} · {{c.nombre}}</span><span class="block text-xs text-slate-500">{{c.walletType||'Spot/Fondos'}} · {{c.operaciones}} movimientos</span><span class="mt-1 block text-xs font-semibold text-emerald-700">{{numero(c.usdt)}} USDT libre</span></span>
              <span class="text-slate-400">›</span>
            </button>
            <p v-if="!cuentasFiltradas.length" class="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No hay cuentas de prueba.</p>
          </div>
          <form v-if="mostrarCuenta" class="mt-4 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3" @submit.prevent="crearCuenta">
            <label class="block text-xs font-semibold">Exchange<select v-model="nuevaCuenta.exchange" class="mt-1 w-full rounded-lg border bg-white p-2 text-sm"><option>BingX</option><option>Binance</option><option>Bybit</option><option>OKX</option><option>Tangem</option><option>Otro</option></select></label>
            <label class="block text-xs font-semibold">Tipo de billetera<select v-model="nuevaCuenta.walletType" class="mt-1 w-full rounded-lg border bg-white p-2 text-sm"><option>Spot</option><option>Fondos</option><option>Futures</option><option>Externa</option></select></label>
            <label class="block text-xs font-semibold">Nombre<input v-model="nuevaCuenta.nombre" maxlength="60" required placeholder="Principal" class="mt-1 w-full rounded-lg border bg-white p-2 text-sm"/></label>
            <button class="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Crear cuenta demo</button>
          </form>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="font-bold">Acciones de prueba</p>
          <p class="mt-1 text-xs text-slate-500">Registra un movimiento sin operar en exchanges.</p>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button class="rounded-xl bg-emerald-700 px-2 py-2.5 text-xs font-semibold text-white" @click="nuevaOperacion('DEPOSITO')">+ Depositar</button>
            <button class="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold" @click="nuevaOperacion('RETIRO')">↗ Retirar</button>
            <button class="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold" @click="nuevaOperacion('TRANSFERENCIA')">⇄ Transferir</button>
            <button class="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold" @click="nuevaOperacion('COMPRA')">↓ Comprar</button>
            <button class="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold" @click="nuevaOperacion('VENTA')">↑ Vender</button>
            <button class="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold" @click="nuevaOperacion('COMISION')">− Comisión</button>
          </div>
        </div>
      </aside>

      <div class="min-w-0 space-y-4">
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div><p class="text-xs font-semibold uppercase tracking-wider text-emerald-700">{{cuentaDetalle?cuentaDetalle.exchange+' · '+cuentaDetalle.nombre:'Consolidado de cuentas'}}</p><h2 class="mt-1 text-xl font-extrabold">Fondos y monedas</h2><p class="mt-1 text-xs text-slate-500">Saldos reconstruidos desde movimientos locales.</p></div>
            <span class="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Vista DEMO · {{cuentaDetalle?.walletType||'Todas las billeteras'}}</span>
          </div>
          <div class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p class="text-xs font-semibold text-emerald-800">USDT libre</p>
            <p class="mt-1 text-2xl font-extrabold tabular-nums text-emerald-800 sm:text-3xl">{{numero(cuentaDetalle?saldoDe(cuentaDetalle.id,'USDT'):totalUSDT)}} <span class="text-base">USDT</span></p>
            <p class="mt-1 text-xs text-slate-500">No incluye el costo histórico de compras de AWS.</p>
          </div>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2"><h3 class="font-bold">Activos disponibles</h3><button class="text-xs font-semibold text-emerald-700" @click="cambiarTab('activos')">Ver detalle de activos</button></div>
          <div class="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
            <div v-for="[a,q] in detalleSaldos" :key="a" class="flex items-center gap-3 px-3 py-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" :class="a==='USDT'?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-800'">{{a.substring(0,2)}}</span>
              <span class="min-w-0 flex-1"><strong class="block text-sm">{{a}}</strong><span class="text-xs text-slate-500">{{a==='USDT'?'Saldo disponible':'Cripto adquirida / recibida'}}</span></span>
              <span class="text-right text-sm font-bold tabular-nums">{{numero(q)}}<small class="block text-xs font-normal text-slate-500">{{a}}</small></span>
            </div>
            <div v-if="!detalleSaldos.length" class="p-5 text-center text-sm text-slate-500">Sin monedas en esta cuenta.</div>
          </div>
        </section>

        <nav class="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1" aria-label="Detalle de billetera">
          <button v-for="t in ([['cuentas','Actividad'],['activos','Saldos'],['movimientos','Historial']] as const)" :key="t[0]" class="rounded-lg px-2 py-2.5 text-xs font-bold sm:text-sm" :class="tab===t[0]?'bg-emerald-50 text-emerald-800':'text-slate-600 hover:bg-slate-50'" @click="cambiarTab(t[0])">{{t[1]}}</button>
        </nav>
        <section v-if="tab==='activos'" class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 class="font-bold">Detalle de saldos</h2><p class="mt-1 text-xs text-slate-500">Por moneda, sin valuación ficticia ni indicadores de rendimiento.</p>
          <div class="mt-4 space-y-2"><div v-for="c in cuentasConDetalle" :key="c.id" class="rounded-xl border border-slate-100 p-3"><p class="text-sm font-bold">{{c.exchange}} · {{c.nombre}}</p><div v-for="[a,q] in c.saldos" :key="a" class="mt-2 flex justify-between text-sm"><span>{{a}}</span><strong class="tabular-nums">{{numero(q)}}</strong></div><p v-if="!c.saldos.length" class="text-xs text-slate-500">Sin activos disponibles</p></div></div>
        </section>
        <section v-else class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div class="flex flex-wrap items-start justify-between gap-2"><div><h2 class="font-bold">{{tab==='movimientos'?'Historial de movimientos':'Últimos movimientos'}}</h2><p class="mt-1 text-xs text-slate-500">Depósitos, retiros, transferencias, compras, ventas y comisiones.</p></div><button v-if="tab!=='movimientos'" class="text-xs font-bold text-emerald-700" @click="cambiarTab('movimientos')">Ver historial completo →</button></div>
          <div v-if="tab==='movimientos'" class="mt-4 grid gap-2 sm:grid-cols-3">
            <label class="text-xs font-semibold text-slate-600">Tipo<select v-model="tipoMovimiento" class="mt-1 w-full rounded-lg border p-2 text-sm"><option value="TODOS">Todos los tipos</option><option v-for="(valor,t) in tipos" :key="t" :value="t">{{valor}}</option></select></label>
            <label class="text-xs font-semibold text-slate-600">Cuenta<select v-model="cuentaSeleccionada" class="mt-1 w-full rounded-lg border p-2 text-sm"><option value="TODAS">Todas</option><option v-for="c in cuentasFiltradas" :key="c.id" :value="c.id">{{c.exchange}} · {{c.nombre}}</option></select></label>
            <label class="text-xs font-semibold text-slate-600">Buscar<input v-model="busqueda" placeholder="BTC, comisión, cuenta…" class="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
          </div>
          <form v-if="mostrarFormulario" class="mt-4 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:grid-cols-2" @submit.prevent="registrar">
            <label class="text-xs font-semibold">Movimiento<select v-model="form.tipo" class="mt-1 w-full rounded-lg border p-2 text-sm"><option v-for="(valor,t) in tipos" :key="t" :value="t">{{valor}}</option></select></label>
            <label class="text-xs font-semibold">Cuenta<select v-model="form.origen" class="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">Seleccionar</option><option v-for="c in cuentas" :key="c.id" :value="c.id">{{c.exchange}} · {{c.nombre}}</option></select></label>
            <label v-if="form.tipo==='TRANSFERENCIA'" class="text-xs font-semibold">Destino<select v-model="form.destino" class="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">Seleccionar</option><option v-for="c in cuentas.filter(x=>x.id!==form.origen)" :key="c.id" :value="c.id">{{c.exchange}} · {{c.nombre}}</option></select></label>
            <label class="text-xs font-semibold">Moneda<input v-model="form.activo" maxlength="15" placeholder="USDT, BTC..." class="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
            <label class="text-xs font-semibold">Cantidad<input v-model="form.cantidad" type="number" min="0.00000001" step="any" placeholder="0.00" class="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
            <label v-if="form.tipo==='COMPRA'||form.tipo==='VENTA'" class="text-xs font-semibold">Precio unitario USDT<input v-model="form.precio" type="number" min="0.00000001" step="any" class="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
            <label class="text-xs font-semibold sm:col-span-2">Descripción<input v-model="form.nota" maxlength="160" placeholder="Motivo del movimiento" class="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
            <div class="flex flex-wrap items-end gap-2"><button class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Guardar movimiento demo</button><button type="button" class="rounded-lg border bg-white px-3 py-2 text-sm" @click="mostrarFormulario=false">Cancelar</button></div>
          </form>
          <p v-if="errorForm" class="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{errorForm}}</p>
          <div class="mt-4 divide-y divide-slate-100">
            <button v-for="m in (tab==='movimientos'?movimientoPagina:movimientosVista.slice(0,6))" :key="m.id" class="w-full px-1 py-3 text-left hover:bg-slate-50" @click="detalleId=detalleId===m.id?'':m.id">
              <span class="flex items-start gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold" :class="movimientoColor(m)">{{movimientoSigno(m)}}</span>
                <span class="min-w-0 flex-1"><strong class="block text-sm">{{tipos[m.tipo]}} <span class="text-xs font-normal text-slate-400">· {{m.activo}}</span></strong><span class="mt-1 block text-xs text-slate-500">{{nombreCuenta(m.origen)}}<span v-if="m.destino"> → {{nombreCuenta(m.destino)}}</span></span><span class="mt-1 block text-[11px] text-slate-400">{{fecha(m.fecha)}}</span></span>
                <span class="text-right"><span class="block text-sm font-bold tabular-nums">{{movimientoSigno(m)}} {{numero(m.cantidad)}} {{m.activo}}</span><small v-if="detalleCambio(m)" class="text-xs text-slate-500">{{detalleCambio(m)}}</small></span></span>
              <span v-if="detalleId===m.id" class="mt-3 block rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{{m.nota||'Sin descripción'}}<span v-if="m.precio" class="block">Precio unitario: {{usd(m.precio)}} · Total: {{detalleCambio(m)}}</span><span class="mt-1 block font-medium">Movimiento local de prueba · {{m.id}}</span></span>
            </button>
            <p v-if="!(tab==='movimientos'?movimientoPagina:movimientosVista.slice(0,6)).length" class="p-5 text-center text-sm text-slate-500">No se encontraron movimientos.</p>
          </div>
          <div v-if="tab==='movimientos'" class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3"><p class="text-xs text-slate-500">{{movimientosVista.length}} movimientos · Página {{movimientosPagina}} de {{numeroPaginas}}</p><div class="flex gap-2"><button class="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40" :disabled="movimientosPagina<=1" @click="movimientosPagina--">Anterior</button><button class="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40" :disabled="movimientosPagina>=numeroPaginas" @click="movimientosPagina++">Siguiente</button></div></div>
        </section>
      </div>
    </section>
    <section class="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
      <div class="flex flex-wrap items-center justify-between gap-2"><strong>Compras registradas en AWS · referencia independiente</strong><button class="font-bold text-emerald-700 disabled:opacity-50" :disabled="cargando" @click="cargarAWS">{{cargando?'Consultando…':'Actualizar consulta'}}</button></div>
      <p class="mt-1">{{comprasAWS.length}} compras cargadas · Capital histórico {{usd(invertidoAWS)}}. No forma parte de los saldos simulados; el dato puede ser parcial y no equivale al balance real.</p>
      <p class="mt-2 text-slate-500">Las transacciones y saldos reales requerirán API autorizada, movimientos históricos completos y conciliación. Esta pantalla no ejecuta trades ni envía cambios a AWS.</p>
    </section>
  </main>
</template>
