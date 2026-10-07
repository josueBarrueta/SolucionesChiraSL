import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './contacto.component.html',
  styleUrls: ['./contacto.component.scss']
})
export class ContactoComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly fb = inject(FormBuilder);

  // Cuando tengas el correo de la empresa, ponlo entre las comillas.
  // Ejemplo: 'contacto@tudominio.com'
  readonly correoDestino = 'josuebarruetacontacto@gmail.com';

  estado = '';

  readonly formulario = this.fb.nonNullable.group({
    nombre: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
        Validators.pattern(/\S/)
      ]
    ],
    correo: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(150)
      ]
    ],
    telefono: ['', [Validators.maxLength(30)]],
    servicio: ['', [Validators.required]],
    localidad: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/\S/)
      ]
    ],
    mensaje: [
      '',
      [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(1500),
        Validators.pattern(/\S/)
      ]
    ]
  });

  constructor() {
    this.title.setTitle(
      'Contacto | Soluciones Chira SL en Valencia'
    );

    this.meta.updateTag({
      name: 'description',
      content:
        'Contacta con Soluciones Chira SL en Valencia. Consulta nuestros servicios de portes, mudanzas, montaje de muebles, vaciados, limpieza y pintura.'
    });
  }

  tieneError(
    campo: keyof typeof this.formulario.controls
  ): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  abrirGmail(): void {
    this.estado = '';

    // Elimina espacios sobrantes antes de validar.
    const valores = this.formulario.getRawValue();

    this.formulario.patchValue({
      nombre: valores.nombre.trim(),
      correo: valores.correo.trim(),
      telefono: valores.telefono.trim(),
      localidad: valores.localidad.trim(),
      mensaje: valores.mensaje.trim()
    });

    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      this.estado =
        'Revisa los campos indicados antes de continuar.';
      return;
    }

    const destinatario = this.correoDestino.trim();

    if (
      !destinatario ||
      Validators.email(this.fb.control(destinatario)) !== null
    ) {
      this.estado =
        'El correo de contacto todavía no está disponible. Puedes llamarnos al 610 92 85 21.';
      return;
    }

    const datos = this.formulario.getRawValue();

    const asunto =
      `Consulta de ${datos.servicio} — ${datos.nombre}`;

    const cuerpo = [
      'Hola, equipo de Soluciones Chira:',
      '',
      'Me gustaría consultar el siguiente trabajo:',
      '',
      `Nombre: ${datos.nombre}`,
      `Correo de contacto: ${datos.correo}`,
      `Teléfono: ${datos.telefono || 'No indicado'}`,
      `Servicio: ${datos.servicio}`,
      `Localidad: ${datos.localidad}`,
      '',
      'Descripción:',
      datos.mensaje,
      '',
      'Gracias.'
    ].join('\n');

    const parametros = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: destinatario,
      su: asunto,
      body: cuerpo
    });

    const url =
      `https://mail.google.com/mail/?${parametros.toString()}`;

    // Abre Gmail directamente desde el clic del visitante.
    // Conserva los campos para poder volver a abrir el borrador.
    window.open(url, '_blank', 'noopener,noreferrer');

    this.estado =
      'Revisa la pestaña de Gmail y pulsa Enviar allí. Si no se abrió o el borrador no aparece después de iniciar sesión, vuelve a pulsar «Continuar en Gmail».';
  }
}