import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError, ChiraApiService, Encuesta } from '../../shared/chira-api.service';
@Component({selector:'app-admin-informes',standalone:true,imports:[FormsModule],templateUrl:'./admin-informes.component.html',styleUrls:['../gestion/gestion.component.scss','./admin-informes.component.scss']})
export class AdminInformesComponent {
  private readonly api=inject(ChiraApiService);private readonly router=inject(Router);
  encuestas:Encuesta[]=[]; trabajos:Record<string,any>[]=[]; facturas:Record<string,any>[]=[]; gastos:Record<string,any>[]=[];
  desde='';hasta='';loading=true;error='';
  private readonly document=inject(DOCUMENT);
  period='mes'; anchor=this.dateKey(new Date());
  constructor(){this.applyPeriod();void this.load();}
  dateKey(date:Date):string{return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  applyPeriod():void{
    if(this.period==='todo'){this.desde='';this.hasta='';return;}
    if(this.period==='personalizado'||!this.anchor)return;
    const [year,month,day]=this.anchor.split('-').map(Number);const start=new Date(year,month-1,day,12);const end=new Date(start);
    if(this.period==='semana'){start.setDate(start.getDate()-((start.getDay()+6)%7));end.setTime(start.getTime());end.setDate(end.getDate()+6);}
    if(this.period==='mes'){start.setDate(1);end.setMonth(end.getMonth()+1,0);}
    if(this.period==='ano'){start.setMonth(0,1);end.setMonth(11,31);}
    this.desde=this.dateKey(start);this.hasta=this.dateKey(end);
  }
  get periodLabel():string{return this.desde&&this.hasta?`${this.desde} — ${this.hasta}`:'Todo el periodo';}
  print():void{
    if(this.loading||this.error||this.invalid)return;
    const popup=this.document.defaultView?.open('','_blank');if(!popup){this.error='Permite ventanas emergentes para imprimir el informe.';return;}
    const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
    const table=(headers:string[],rows:unknown[][])=>`<table><thead><tr>${headers.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(cell=>`<td>${escape(cell)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">Sin registros en este periodo.</td></tr>`}</tbody></table>`;
    const jobs=[...this.jobs].sort((a,b)=>String(a['fecha']).localeCompare(String(b['fecha'])));
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe · ${escape(this.periodLabel)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eeefe9;color:#252b25;font:13px/1.5 Arial,sans-serif}.toolbar{max-width:850px;margin:24px auto;text-align:right}button{background:#294633;color:white;border:0;border-radius:6px;padding:12px 20px;font:inherit;cursor:pointer}main{max-width:850px;margin:0 auto 40px;padding:44px;background:white;border-top:6px solid #294633}header{border-bottom:1px solid #ccd5c9;padding-bottom:24px;margin-bottom:24px}.brand{font-size:23px;font-weight:bold;color:#294633}h1{font-size:25px;margin:12px 0 8px}h2{font-size:15px;color:#294633;margin:30px 0 12px}.period{color:#586258}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.metric{padding:12px;border-bottom:1px solid #dbe1d8;display:flex;justify-content:space-between;gap:14px}.metric strong{white-space:nowrap}table{width:100%;border-collapse:collapse}th{text-align:left;color:#52634f;font-size:11px;border-bottom:2px solid #294633}th,td{padding:10px 6px;vertical-align:top;overflow-wrap:anywhere}td{border-bottom:1px solid #e1e6de}tr{break-inside:avoid}thead{display:table-header-group}.note,footer{font-size:11px;color:#667064}footer{margin-top:30px;padding-top:18px;border-top:1px dashed #bdc7bb}@page{size:A4;margin:16mm}@media print{body{background:white}.toolbar{display:none}main{padding:0;margin:0;max-width:none;border-top:3px solid #294633;padding-top:8mm}.metrics{break-inside:avoid}h2{break-after:avoid}}@media(max-width:600px){main{padding:22px}.metrics{grid-template-columns:1fr}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / guardar PDF</button></div><main><header><div class="brand">Soluciones Chira SL</div><h1>Informe de actividad</h1><div class="period">Periodo: ${escape(this.periodLabel)}</div></header><div class="metrics">${this.metrics.map(m=>`<div class="metric"><span>${escape(m.label)}</span><strong>${escape(m.value)}</strong></div>`).join('')}</div><p class="note">Los trabajos se seleccionan por su fecha prevista; su estado indica cuáles están finalizados. Los cobros se seleccionan por fecha de pago. El pendiente corresponde al saldo actual de las facturas del periodo. Cobros menos gastos no equivale al beneficio contable.</p><h2>Trabajos del periodo</h2>${table(['Fecha prevista','Trabajo','Estado'],jobs.map(r=>[r['fecha'],r['titulo'],r['estado']]))}<h2>Facturas registradas</h2>${table(['Fecha','Referencia','Total','Pendiente actual'],this.invoices.map(r=>[r['fecha'],r['referencia'],this.money(r['totalCentimos']),this.money(r['totalCentimos']-r['pagadoCentimos'])]))}<h2>Gastos del periodo</h2>${table(['Fecha','Concepto','Categoría','Importe'],this.expenses.map(r=>[r['fecha'],r['concepto'],r['categoria'],this.money(r['importeCentimos'])]))}<h2>Servicios solicitados</h2>${table(['Servicio','Solicitudes'],this.services.map(r=>[r.name,r.count]))}<footer>Resumen de gestión interna · No sustituye una factura ni acredita el pago. Los trabajos sin fecha no se incluyen.</footer></main></body></html>`);
    popup.document.close();popup.opener=null;
  }
  money(value:number):string{return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);}
  inRange(date:string):boolean{return !!date&&(!this.desde||date>=this.desde)&&(!this.hasta||date<=this.hasta);}
  get invalid():boolean{return !!this.desde&&!!this.hasta&&this.desde>this.hasta;}
  get invoices():Record<string,any>[]{return this.facturas.filter(r=>r['estado']==='Registrada'&&this.inRange(r['fecha']));}
  get expenses():Record<string,any>[]{return this.gastos.filter(r=>!r['archivada']&&this.inRange(r['fecha']));}
  get billed():number{return this.invoices.reduce((s,r)=>s+r['totalCentimos'],0);}
  get collected():number{return this.facturas.filter(r=>r['estado']==='Registrada').flatMap(r=>r['pagos']??[]).filter(p=>this.inRange(p['fecha'])).reduce((s,p)=>s+p['importeCentimos'],0);}
  get outstanding():number{return this.invoices.reduce((s,r)=>s+r['totalCentimos']-r['pagadoCentimos'],0);}
  get spent():number{return this.expenses.reduce((s,r)=>s+r['importeCentimos'],0);}
  get jobs():Record<string,any>[]{return this.trabajos.filter(r=>!r['archivada']&&this.inRange(r['fecha']));}
  get services():{name:string;count:number}[]{const counts=new Map<string,number>();for(const e of this.encuestas.filter(e=>!e.archivada&&this.inRange(e.fecha)))for(const name of e.servicios)counts.set(name,(counts.get(name)??0)+1);return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);}
  get categories():{name:string;value:number}[]{const values=new Map<string,number>();for(const e of this.expenses)values.set(e['categoria'],(values.get(e['categoria'])??0)+e['importeCentimos']);return [...values].map(([name,value])=>({name,value}));}
  get metrics():{label:string;value:string|number}[]{return [{label:'Solicitudes recibidas',value:this.encuestas.filter(e=>this.inRange(e.fecha)).length},{label:'Trabajos programados',value:this.jobs.length},{label:'Trabajos finalizados',value:this.jobs.filter(r=>r['estado']==='Finalizado').length},{label:'Facturado (con IVA)',value:this.money(this.billed)},{label:'Cobrado en el periodo',value:this.money(this.collected)},{label:'Pendiente de las facturas del periodo',value:this.money(this.outstanding)},{label:'Gastos registrados',value:this.money(this.spent)},{label:'Cobros menos gastos',value:this.money(this.collected-this.spent)}];}
  async load():Promise<void>{this.loading=true;this.error='';try{const [surveys,...records]=await Promise.all([this.api.listar(),...['trabajos','facturas','gastos'].map(name=>this.api.request<{registros:Record<string,any>[]}>(`/gestion/${name}`))]);this.encuestas=(surveys as {encuestas:Encuesta[]}).encuestas;[this.trabajos,this.facturas,this.gastos]=records.map(r=>(r as {registros:Record<string,any>[]}).registros);}catch(e){this.error=e instanceof Error?e.message:'No se pudieron cargar los informes.';if(e instanceof ApiError&&e.status===401)await this.router.navigate(['/login']);}finally{this.loading=false;}}
}
