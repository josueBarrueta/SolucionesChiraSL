import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError, ChiraApiService, Encuesta } from '../../shared/chira-api.service';

type Resource = 'clientes' | 'equipo' | 'trabajos' | 'gastos' | 'presupuestos' | 'facturas';
type Row = Record<string, any>;
interface Field { key: string; label: string; type?: string; required?: boolean; options?: string[]; source?: Resource | 'encuestas'; }
const fields: Record<Resource, Field[]> = {
  clientes: [{key:'nombre', label:'Nombre o razón social', required:true}, {key:'email',label:'Correo',type:'email'}, {key:'telefono',label:'Teléfono',type:'tel'}, {key:'nif',label:'NIF / CIF'}, {key:'direccion',label:'Dirección'}, {key:'localidad',label:'Localidad'}, {key:'codigoPostal',label:'Código postal'}],
  equipo: [{key:'nombre',label:'Nombre',required:true}, {key:'email',label:'Correo',type:'email'}, {key:'telefono',label:'Teléfono',type:'tel'}, {key:'funcion',label:'Función'}, {key:'disponibilidad',label:'Disponibilidad',type:'textarea'}],
  trabajos: [{key:'titulo',label:'Servicio / trabajo',required:true}, {key:'clienteId',label:'Cliente',source:'clientes'}, {key:'encuestaId',label:'Solicitud de origen',source:'encuestas'}, {key:'presupuestoId',label:'Presupuesto',source:'presupuestos'}, {key:'fecha',label:'Fecha prevista',type:'date'}, {key:'estado',label:'Estado',options:['Pendiente','En curso','Finalizado','Cancelado'],required:true}, {key:'direccion',label:'Lugar del trabajo'}, {key:'descripcion',label:'Descripción',type:'textarea'}, {key:'tareas',label:'Tareas y materiales',type:'textarea'}],
  gastos: [{key:'concepto',label:'Concepto',required:true}, {key:'fecha',label:'Fecha',type:'date',required:true}, {key:'categoria',label:'Categoría',options:['Materiales','Combustible','Personal','Transporte','Otros'],required:true}, {key:'importe',label:'Importe (€)',type:'number',required:true}, {key:'trabajoId',label:'Trabajo relacionado',source:'trabajos'}, {key:'justificante',label:'Referencia o ubicación del justificante'}],
  presupuestos: [{key:'clienteId',label:'Cliente',source:'clientes',required:true}, {key:'trabajoId',label:'Trabajo',source:'trabajos'}, {key:'fecha',label:'Fecha',type:'date',required:true}, {key:'vencimiento',label:'Válido hasta',type:'date'}, {key:'estado',label:'Estado',options:['Borrador','Enviado','Aceptado','Rechazado'],required:true}],
  facturas: [{key:'numeroExterno',label:'Número de factura externa (opcional)'},{key:'clienteId',label:'Cliente',source:'clientes',required:true}, {key:'trabajoId',label:'Trabajo',source:'trabajos'}, {key:'presupuestoId',label:'Presupuesto',source:'presupuestos'}, {key:'fecha',label:'Fecha',type:'date',required:true}, {key:'vencimiento',label:'Vencimiento',type:'date'}]
};
@Component({selector:'app-gestion', standalone:true, imports:[FormsModule,RouterLink], templateUrl:'./gestion.component.html', styleUrls:['./gestion.component.scss']})
export class GestionComponent implements OnInit, OnDestroy {
  @Input({required:true}) resource!: Resource;
  @ViewChild('editor',{static:true}) editor!: ElementRef<HTMLDialogElement>;
  private readonly api = inject(ChiraApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private overflow: string | null = null;
  data: Record<Resource, Row[]> = {clientes:[],equipo:[],trabajos:[],gastos:[],presupuestos:[],facturas:[]};
  encuestas: Encuesta[] = [];
  empresa: Row = {};
  draft: Row = {};
  loading = false;
  saving = false;
  error = '';
  editorError = '';
  message = '';
  search = '';
  showArchived = false;
  status = '';
  selected: Row | null = null;
  payment: Row = {};
  readonly today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
  get title(): string { return {clientes:'Clientes',equipo:'Equipo',trabajos:'Trabajos',gastos:'Gastos',presupuestos:'Presupuestos',facturas:'Facturas'}[this.resource]; }
  get fields(): Field[] { return fields[this.resource]; }
  get documents(): boolean { return ['presupuestos','facturas'].includes(this.resource); }
  get issued(): boolean { return this.resource === 'facturas' && this.draft['estado'] === 'Registrada'; }
  get rows(): Row[] { return this.data[this.resource].filter(row => row['archivada'] === this.showArchived && (!this.status || row['estado'] === this.status) && `${row['nombre']??''} ${row['titulo']??''} ${row['concepto']??''} ${row['referencia']??''} ${this.clientName(row['clienteId'])} ${row['email']??''}`.toLocaleLowerCase('es').includes(this.search.toLocaleLowerCase('es'))); }
  get states(): string[] { return fields[this.resource].find(f=>f.key==='estado')?.options ?? (this.resource==='facturas' ? ['Borrador','Registrada'] : []); }
  get draftTotal(): number { return (this.draft['lineas'] ?? []).reduce((sum:number,line:Row) => {const base=Math.round(Number(line['cantidad']??0)*Number(line['precio']??0)*100);return sum+base+Math.round(base*Number(line['iva']??0)/100);},0); }
  get history(): {label:string; url:string; query:Record<string,string>}[] {
    if (this.resource !== 'clientes' || !this.draft['id']) return [];
    const email = String(this.draft['email']??'').toLowerCase();
    return [...this.encuestas.filter(e=>email && e.email.toLowerCase()===email).map(e=>({label:`${e.referencia} · ${e.servicios.join(', ')} · ${e.estado}`,url:'/admin/encuestas',query:{respuesta:e.id}})), ...(['trabajos','presupuestos','facturas'] as Resource[]).flatMap(name=>this.data[name].filter(r=>r['clienteId']===this.draft['id']).map(r=>({label:`${r['titulo']??r['referencia']??'Borrador'} · ${r['estado']}`,url:`/admin/${name}`,query:{registro:r['id']}})))];
  }
  ngOnInit(): void { const state=this.route.snapshot.queryParamMap.get('estado');if(state && this.states.includes(state))this.status=state;void this.load(); }
  ngOnDestroy(): void { this.restoreScroll(); }
  money(cents:number): string { return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format((cents??0)/100); }
  clientName(id:string): string { return this.data.clientes.find(r=>r['id']===id)?.['nombre'] ?? 'Sin cliente'; }
  label(row:Row): string { return row['nombre']??row['titulo']??row['concepto']??row['referencia']??'Factura en borrador'; }
  options(source:Resource|'encuestas', current?:string): Row[] { return source==='encuestas' ? this.encuestas.map(e=>({id:e.id,nombre:`${e.referencia} · ${e.nombre}`})) : this.data[source].filter(r=>!r['archivada'] || r['id']===current); }
  async load(): Promise<void> {
    this.loading=true; this.error='';
    try { const names=Object.keys(this.data) as Resource[]; const [records,surveys,settings]=await Promise.all([Promise.all(names.map(name=>this.api.request<{registros:Row[]}>(`/gestion/${name}`))),this.api.listar(),this.api.request<{configuracion:Row}>('/gestion/configuracion')]); names.forEach((name,i)=>this.data[name]=records[i].registros); this.encuestas=surveys.encuestas;this.empresa=settings.configuracion;
      const id=this.route.snapshot.queryParamMap.get('registro');
      if(id && !this.editor.nativeElement.open) {const row=this.data[this.resource].find(r=>r['id']===id);if(row)this.open(row);} }
    catch(e) { this.error=e instanceof Error?e.message:'No se pudieron cargar los datos.'; if(e instanceof ApiError && e.status===401) await this.router.navigate(['/login']); }
    finally {this.loading=false;}
  }
  open(row?:Row): void {
    this.selected=row??null; this.editorError='';
    this.draft=row?structuredClone(row):{nombre:'',titulo:'',concepto:'',email:'',telefono:'',nif:'',direccion:'',localidad:'',codigoPostal:'',funcion:'',disponibilidad:'',clienteId:'',trabajoId:'',encuestaId:'',presupuestoId:'',estado:this.resource==='trabajos'?'Pendiente':'Borrador',fecha:this.today,vencimiento:'',categoria:'Otros',importe:0,equipoIds:[],descripcion:'',tareas:'',notas:'',condiciones:this.empresa['condiciones']??'',archivada:false,lineas:[{concepto:'',cantidad:1,precio:0,iva:this.empresa['ivaPredeterminado']}]};
    if(this.resource==='gastos' && row) this.draft['importe']=row['importeCentimos']/100;
    this.payment={importe:0,fecha:this.today,metodo:'Transferencia'};
    if(!this.editor.nativeElement.open) {this.overflow=this.document.body.style.overflow;this.document.body.style.overflow='hidden';this.editor.nativeElement.showModal();}
  }
  close(): void {if(this.saving)return;this.editor.nativeElement.close();this.restoreScroll();if(this.route.snapshot.queryParamMap.has('registro'))void this.router.navigate([], {relativeTo:this.route,queryParams:{registro:null},queryParamsHandling:'merge',replaceUrl:true});}
  restoreScroll(): void {if(this.overflow!==null) {this.document.body.style.overflow=this.overflow;this.overflow=null;}}
  async save(): Promise<void> {
    if(this.saving || this.issued)return;this.editorError='';
    if(this.resource==='gastos' && !this.validAmount(this.draft['importe'])) {this.editorError='Introduce un importe de al menos 0,01 € y como máximo dos decimales.';return;}
    this.saving=true;
    try {await this.api.request(`/gestion/${this.resource}${this.draft['id']?'/'+this.draft['id']:''}`,this.draft['id']?'PATCH':'POST',this.draft);this.message='Registro guardado.';this.saving=false;this.close();await this.load();}
    catch(e){this.editorError=e instanceof Error?e.message:'No se pudo guardar.';}finally{this.saving=false;}
  }
  async archive(): Promise<void> {this.draft['archivada']=!this.draft['archivada'];await this.save(); if(this.editorError)this.draft['archivada']=!this.draft['archivada'];}
  async sync(): Promise<void> {if(this.loading)return;this.loading=true;this.error='';try{const result=await this.api.request<{trabajos:number}>('/gestion/sincronizar','POST',{});this.message=`Solicitudes sincronizadas: ${result.trabajos} trabajos vinculados, sin duplicados.`;await this.load();}catch(e){this.error=e instanceof Error?e.message:'No se pudo sincronizar.';}finally{this.loading=false;}}
  team(id:string,event:Event): void {const checked=(event.target as HTMLInputElement).checked;this.draft['equipoIds']=checked?[...this.draft['equipoIds'],id]:this.draft['equipoIds'].filter((x:string)=>x!==id);}
  addLine(): void {this.draft['lineas'].push({concepto:'',cantidad:1,precio:0,iva:this.empresa['ivaPredeterminado']});}
  useBudget(): void {const budget=this.data.presupuestos.find(r=>r['id']===this.draft['presupuestoId']);if(budget){this.draft['clienteId']=budget['clienteId'];this.draft['trabajoId']=budget['trabajoId'];this.draft['lineas']=structuredClone(budget['lineas']);}}
  async issue(): Promise<void> {if(this.saving)return;this.saving=true;this.editorError='';try{const result=await this.api.request<{registro:Row}>(`/gestion/facturas/${this.draft['id']}/emitir`,'POST',{});this.draft=result.registro;this.message='Factura registrada para el control interno.';await this.load();}catch(e){this.editorError=e instanceof Error?e.message:'No se pudo emitir.';}finally{this.saving=false;}}
  validAmount(value:unknown): boolean {if(typeof value!=='number' || !Number.isFinite(value) || value<0.01)return false;const scaled=value*100;return Math.abs(scaled-Math.round(scaled))<=Number.EPSILON*Math.max(1,Math.abs(scaled))*4;}
  async pay(): Promise<void> {if(this.saving)return;if(!this.validAmount(this.payment['importe'])){this.editorError='Introduce un pago de al menos 0,01 € y como máximo dos decimales.';return;}this.saving=true;this.editorError='';try{const result=await this.api.request<{registro:Row}>(`/gestion/facturas/${this.draft['id']}/pago`,'POST',this.payment);this.draft=result.registro;this.payment['importe']=0;this.message='Pago registrado.';await this.load();}catch(e){this.editorError=e instanceof Error?e.message:'No se pudo registrar el pago.';}finally{this.saving=false;}}
  print(): void {
    const row=this.data[this.resource].find(r=>r['id']===this.draft['id']) ?? this.draft;const empresa=row['empresa']??this.empresa;const cliente=row['cliente']??this.data.clientes.find(r=>r['id']===row['clienteId'])??{};
    const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
    const popup=this.document.defaultView?.open('','_blank'); if(!popup){this.editorError='Permite ventanas emergentes para imprimir o guardar como PDF.';return;}
    popup.document.write(`<html lang="es"><head><title>${escape(row['referencia']??'Borrador')}</title><style>body{font:14px Arial;color:#20271e;max-width:900px;margin:40px auto;padding:24px}h1{color:#253c1c}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}.total{text-align:right;font-size:18px}p{white-space:pre-wrap}@media print{button{display:none}}</style></head><body><h1>${this.resource==='facturas'?'Registro interno de factura':'Presupuesto'} ${escape(row['referencia']??'BORRADOR')}</h1><p>${escape(empresa['nombre'])}\n${escape(empresa['nif'])}\n${escape(empresa['direccion'])}\n${escape(empresa['email'])}</p><h2>Cliente</h2><p>${escape(cliente['nombre'])}\n${escape(cliente['nif'])}\n${escape(cliente['direccion'])}</p><p>Fecha: ${escape(row['fecha'])} · Vencimiento: ${escape(row['vencimiento'])}</p><table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio</th><th>IVA</th><th>Base</th></tr></thead><tbody>${(row['lineas']??[]).map((line:Row)=>`<tr><td>${escape(line['concepto'])}</td><td>${escape(line['cantidad'])}</td><td>${this.money(Math.round(line['precio']*100))}</td><td>${escape(line['iva'])}%</td><td>${this.money(Math.round(line['cantidad']*line['precio']*100))}</td></tr>`).join('')}</tbody></table><p class="total">Base: ${this.money(row['baseCentimos'])}\nIVA: ${this.money(row['ivaCentimos'])}\nTotal: ${this.money(row['totalCentimos'])}</p><p>${escape(row['condiciones'])}\n${empresa['iban']?'IBAN: '+escape(empresa['iban']):''}</p><button onclick="window.print()">Imprimir / guardar PDF</button></body></html>`);popup.document.close();popup.opener=null;
  }
}
