import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError, ChiraApiService, Encuesta } from '../../shared/chira-api.service';
@Component({selector:'app-admin-informes',standalone:true,imports:[FormsModule],templateUrl:'./admin-informes.component.html',styleUrls:['../gestion/gestion.component.scss','./admin-informes.component.scss']})
export class AdminInformesComponent {
  private readonly api=inject(ChiraApiService);private readonly router=inject(Router);
  encuestas:Encuesta[]=[]; trabajos:Record<string,any>[]=[]; facturas:Record<string,any>[]=[]; gastos:Record<string,any>[]=[];
  desde='';hasta='';loading=true;error='';
  constructor(){void this.load();}
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
