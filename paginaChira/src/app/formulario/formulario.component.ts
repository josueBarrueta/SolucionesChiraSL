import {
  Component,
  OnDestroy,
  inject,
  signal
} from '@angular/core';

import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString
} from 'libphonenumber-js';

import type { CountryCode } from 'libphonenumber-js';

type FormStatus = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './formulario.component.html',
  styleUrls: ['./formulario.component.scss']
})
export class FormularioComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);

  private readonly accessKey: string =
    '8750e45d-4d4b-482f-afe6-8cffd18cfab8';

  private controller?: AbortController;
  private destroyed = false;

  readonly status = signal<FormStatus>('idle');
  readonly errorMessage = signal('');

  readonly services = [
    'Portes',
    'Montaje de muebles',
    'Mudanzas',
    'Vaciados',
    'Limpieza',
    'Pintura',
    'Otra consulta'
  ];

  readonly personalFields = [
    {
      name: 'firstName',
      label: 'Nombre *',
      type: 'text',
      placeholder: 'Tu nombre',
      autocomplete: 'given-name',
      maxlength: 100,
      error: 'Introduce tu nombre.'
    },
    {
      name: 'lastName',
      label: 'Apellidos *',
      type: 'text',
      placeholder: 'Tus apellidos',
      autocomplete: 'family-name',
      maxlength: 150,
      error: 'Introduce tus apellidos.'
    },
    {
      name: 'email',
      label: 'Correo electrónico *',
      type: 'email',
      placeholder: 'tu@email.com',
      autocomplete: 'email',
      maxlength: 254,
      error: 'Introduce un correo electrónico válido.'
    }
  ];

  readonly localities = [
    'Valencia',
    'Alaquàs',
    'Albal',
    'Albalat dels Sorells',
    'Alboraya',
    'Albuixech',
    'Alcàsser',
    'Aldaia',
    'Alfafar',
    'Alfara del Patriarca',
    'Almàssera',
    'Benetússer',
    'Beniparrell',
    'Burjassot',
    'Catarroja',
    'El Puig de Santa Maria',
    'Foios',
    'Godella',
    'La Pobla de Farnals',
    'Llíria',
    'Manises',
    'Massamagrell',
    'Massanassa',
    'Meliana',
    'Mislata',
    'Moncada',
    'Paterna',
    'Paiporta',
    'Picanya',
    'Picassent',
    'Puçol',
    'Quart de Poblet',
    'Rafelbunyol',
    'Riba-roja de Túria',
    'Rocafort',
    'Sagunto',
    'Sedaví',
    'Silla',
    'Tavernes Blanques',
    'Torrent',
    'Vinalesa',
    'Xirivella'
  ].sort((a, b) => a.localeCompare(b, 'es'));

  readonly countries = this.buildCountries();

  readonly form = this.fb.nonNullable.group({
    services: this.fb.nonNullable.control<string[]>([], [
      Validators.required
    ]),

    firstName: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/\S/)
      ]
    ],

    lastName: [
      '',
      [
        Validators.required,
        Validators.maxLength(150),
        Validators.pattern(/\S/)
      ]
    ],

    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(254)
      ]
    ],

    country: this.fb.nonNullable.control<CountryCode>('ES'),

    phone: ['', Validators.required],

    location: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120),
        Validators.pattern(/\S/)
      ]
    ],

    street: ['', Validators.maxLength(160)],
    streetNumber: ['', Validators.maxLength(20)],
    floor: ['', Validators.maxLength(30)],
    door: ['', Validators.maxLength(30)],
    staircase: ['', Validators.maxLength(40)],

    message: [
      '',
      [
        Validators.required,
        Validators.minLength(20),
        Validators.maxLength(3000),
        Validators.pattern(/\S/)
      ]
    ],

    website: ['']
  });

  constructor() {
    this.form.controls.phone.setValidators([
      Validators.required,

      (control: AbstractControl) => {
        if (!control.value) {
          return null;
        }

        const number = parsePhoneNumberFromString(
          String(control.value),
          this.form.controls.country.value
        );

        const selectedPrefix = getCountryCallingCode(
          this.form.controls.country.value
        );

        return number?.isPossible() &&
          number.countryCallingCode === selectedPrefix
          ? null
          : { phone: true };
      }
    ]);

    this.form.controls.phone.updateValueAndValidity({
      emitEvent: false
    });

    this.form.controls.country.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.formatPhoneOnBlur();
      });
  }

  private buildCountries(): {
    code: CountryCode;
    name: string;
    prefix: string;
  }[] {
    const names = new Intl.DisplayNames(['es'], {
      type: 'region'
    });

    return getCountries()
      .map((code) => ({
        code,
        name: names.of(code) ?? code,
        prefix: getCountryCallingCode(code)
      }))
      .sort((a, b) => {
        if (a.code === 'ES') return -1;
        if (b.code === 'ES') return 1;

        return a.name.localeCompare(b.name, 'es');
      });
  }

  invalid(name: string): boolean {
    const control = this.form.get(name);

    return !!control && control.invalid && control.touched;
  }

  isSelected(service: string): boolean {
    return this.form.controls.services.value.includes(service);
  }

  toggleService(service: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const control = this.form.controls.services;

    const selected = checked
      ? [...new Set([...control.value, service])]
      : control.value.filter((item) => item !== service);

    control.setValue(selected);
    control.markAsDirty();
    control.markAsTouched();
  }

  formatPhone(event: Event): void {
    const input = event.target as HTMLInputElement;
    const inputEvent = event as InputEvent;

    // Permite borrar sin reinsertar los separadores inmediatamente.
    if (inputEvent.inputType?.startsWith('delete')) {
      return;
    }

    const position = input.selectionStart ?? input.value.length;

    const digitsBeforeCursor = input.value
      .slice(0, position)
      .replace(/\D/g, '').length;

    const digits = input.value.replace(/\D/g, '');

    const formatted = new AsYouType(
      this.form.controls.country.value
    ).input(digits);

    this.form.controls.phone.setValue(formatted, {
      emitEvent: false
    });

    input.value = formatted;

    // Mantiene el cursor junto al dígito que se estaba editando.
    let cursor = 0;
    let count = 0;

    while (
      cursor < formatted.length &&
      count < digitsBeforeCursor
    ) {
      if (/\d/.test(formatted[cursor])) {
        count++;
      }

      cursor++;
    }

    input.setSelectionRange(cursor, cursor);
  }

  formatPhoneOnBlur(): void {
    const control = this.form.controls.phone;
    const digits = control.value.replace(/\D/g, '');

    const formatted = new AsYouType(
      this.form.controls.country.value
    ).input(digits);

    control.setValue(formatted, {
      emitEvent: false
    });

    control.updateValueAndValidity({
      emitEvent: false
    });
  }

  async submit(): Promise<void> {
    if (this.status() === 'sending') {
      return;
    }

    this.errorMessage.set('');
    this.status.set('idle');

    const current = this.form.getRawValue();

    this.form.patchValue({
      firstName: current.firstName.trim(),
      lastName: current.lastName.trim(),
      email: current.email.trim(),
      location: current.location.trim(),
      street: current.street.trim(),
      streetNumber: current.streetNumber.trim(),
      floor: current.floor.trim(),
      door: current.door.trim(),
      staircase: current.staircase.trim(),
      message: current.message.trim()
    });

    this.formatPhoneOnBlur();
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.errorMessage.set(
        'Revisa los campos indicados antes de enviar.'
      );

      this.status.set('error');
      return;
    }

    if (this.form.controls.website.value) {
      return;
    }

    const clave = this.accessKey.trim();

    if (!clave || clave === '8750e45d-4d4b-482f-afe6-8cffd18cfab8') {
      this.errorMessage.set(
        'El envío todavía no está configurado. Puedes llamarnos al 610 92 85 21.'
      );

      this.status.set('error');
      return;
    }

    const values = this.form.getRawValue();

    const phone = parsePhoneNumberFromString(
      values.phone,
      values.country
    );

    if (!phone) {
      this.form.controls.phone.setErrors({
        phone: true
      });

      return;
    }

    const controller = new AbortController();
    this.controller = controller;

    const timeout = window.setTimeout(
      () => controller.abort(),
      20000
    );

    this.status.set('sending');

    try {
      const response = await fetch(
        'https://api.web3forms.com/submit',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },

          signal: controller.signal,

          body: JSON.stringify({
            access_key: clave,
            subject: `Presupuesto: ${values.services.join(', ')}`,
            from_name: 'Web Soluciones Chira SL',

            name: `${values.firstName} ${values.lastName}`,
            nombre: values.firstName,
            apellidos: values.lastName,
            email: values.email,

            telefono: phone.formatInternational(),
            telefono_internacional: phone.number,

            pais_telefono: this.countries.find(
              (country) => country.code === values.country
            )?.name,

            servicios: values.services.join(', '),
            localidad: values.location,
            calle: values.street || 'No indicada',
            numero: values.streetNumber || 'No indicado',
            piso: values.floor || 'No indicado',
            puerta: values.door || 'No indicada',
            escalera_bloque: values.staircase || 'No indicado',

            message: values.message,
            botcheck: false
          })
        }
      );

      const result: { success?: boolean } =
        await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error('No se pudo confirmar el envío.');
      }

      if (!this.destroyed) {
        this.form.reset();
        this.status.set('success');
      }
    } catch {
      if (!this.destroyed) {
        this.errorMessage.set(
          'No hemos podido confirmar el envío. Conservamos tus datos para que puedas intentarlo de nuevo. Si la conexión se interrumpió, la consulta podría haber llegado; reenviarla podría duplicarla.'
        );

        this.status.set('error');
      }
    } finally {
      window.clearTimeout(timeout);

      if (this.controller === controller) {
        this.controller = undefined;
      }
    }
  }

  newRequest(): void {
    this.errorMessage.set('');
    this.status.set('idle');
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.controller?.abort();
  }
}