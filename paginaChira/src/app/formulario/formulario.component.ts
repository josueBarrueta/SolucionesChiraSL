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

import { ActivatedRoute } from '@angular/router';
import { AddressFeature, addressSuggestion } from './formulario.address';
import { SERVICE_QUESTIONS } from './formulario.questions';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  imports: [ReactiveFormsModule],
  templateUrl: './formulario.component.html',
  styleUrls: ['./formulario.component.scss']
})
export class FormularioComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly serviceQuestions = SERVICE_QUESTIONS;
  readonly details = this.fb.nonNullable.record<string>({});

  get selectedQuestions() {
    return this.serviceQuestions.filter((block) => this.isSelected(block.service));
  }

  private budgetDetails(): Record<string, string> {
    const answers: Record<string, string> = {};

    for (const block of this.selectedQuestions) {
      for (const field of block.fields) {
        const value = this.details.controls[field.name].value.trim();

        if (value) {
          answers[`${block.service} — ${field.label}`] = value;
        }
      }
    }

    return answers;
  }


  private readonly accessKey: string =
    '8750e45d-4d4b-482f-afe6-8cffd18cfab8';

  readonly addressSuggestions = signal<{ value: string; locality: string; postcode: string }[]>([]);
  readonly addressSuggestionsOpen = signal(false);
  readonly activeAddressSuggestion = signal(-1);
  readonly addressSearchStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private addressTimer?: ReturnType<typeof setTimeout>;
  private addressController?: AbortController;
  private addressSearchVersion = 0;

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

    street: ['', Validators.maxLength(180)],
    postalCode: ['', Validators.pattern(/^\d{5}$/)],
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

    details: this.details,
    website: ['']
  });

  constructor() {
    for (const block of this.serviceQuestions) {
      for (const field of block.fields) {
        this.details.addControl(
          field.name,
          this.fb.nonNullable.control('', Validators.maxLength(300))
        );
      }
    }

    this.form.controls.location.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.searchAddress());

    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const selected = this.serviceQuestions.find(
          (block) => block.slug === params.get('servicio')
        );

        if (selected) {
          this.form.controls.services.setValue([selected.service]);
        }
      });

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

  searchAddress(): void {
    clearTimeout(this.addressTimer);
    this.addressController?.abort();
    const version = ++this.addressSearchVersion;
    this.form.controls.postalCode.reset();
    this.addressSuggestions.set([]);
    this.activeAddressSuggestion.set(-1);
    this.addressSuggestionsOpen.set(true);
    this.addressSearchStatus.set('idle');

    const street = this.form.controls.street.value.trim();
    const locality = this.form.controls.location.value.trim();

    if (street.length < 3 || locality.length < 2) {
      return;
    }

    this.addressSearchStatus.set('loading');
    this.addressTimer = setTimeout(() => {
      void this.loadAddressSuggestions(street, locality, version);
    }, 600);
  }

  private async loadAddressSuggestions(
    street: string,
    locality: string,
    version: number
  ): Promise<void> {
    const controller = new AbortController();
    this.addressController = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const params = new URLSearchParams({
        q: `${street}, ${locality}, España`,
        limit: '6',
        lang: 'default'
      });

      const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('No se pudieron cargar las direcciones.');
      }

      const result: { features?: AddressFeature[] } = await response.json();
      const typedNumber = street.match(/\s(\d+\s*[a-z]?)$/i)?.[1];
      const suggestions = (result.features ?? [])
        .map((feature) => addressSuggestion(feature, typedNumber))
        .filter((address): address is NonNullable<typeof address> => address !== null);

      if (!this.destroyed && version === this.addressSearchVersion) {
        this.addressSuggestions.set(
          suggestions.filter((address, index, all) =>
            all.findIndex((item) =>
              item.value === address.value &&
              item.locality === address.locality &&
              item.postcode === address.postcode
            ) === index
          )
        );
        this.addressSearchStatus.set('ready');
      }
    } catch {
      if (!this.destroyed && version === this.addressSearchVersion) {
        this.addressSearchStatus.set('error');
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  selectAddress(index: number): void {
    const address = this.addressSuggestions()[index];

    if (!address) {
      return;
    }

    this.form.controls.street.setValue(address.value);
    this.form.controls.street.markAsDirty();
    this.form.controls.postalCode.setValue(address.postcode);
    clearTimeout(this.addressTimer);
    this.addressController?.abort();
    this.addressSearchVersion++;
    this.addressSearchStatus.set('idle');
    this.addressSuggestionsOpen.set(false);
    this.activeAddressSuggestion.set(-1);
  }

  closeAddressSuggestions(): void {
    this.addressSuggestionsOpen.set(false);
    this.activeAddressSuggestion.set(-1);
  }

  addressKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAddressSuggestions();
      return;
    }

    const count = this.addressSuggestions().length;

    if (!count) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.addressSuggestionsOpen.set(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.activeAddressSuggestion.update((index) => (index + direction + count) % count);
    } else if (
      event.key === 'Enter' &&
      this.addressSuggestionsOpen() &&
      this.activeAddressSuggestion() >= 0
    ) {
      event.preventDefault();
      this.selectAddress(this.activeAddressSuggestion());
    }
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

    if (!checked) {
      const block = this.serviceQuestions.find((item) => item.service === service);

      for (const field of block?.fields ?? []) {
        this.details.controls[field.name].reset();
      }
    }
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
      postalCode: current.postalCode.trim(),
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

    if (!clave) {
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
            direccion: values.street || 'No indicada',
            codigo_postal: values.postalCode || 'No indicado',
            piso: values.floor || 'No indicado',
            puerta: values.door || 'No indicada',
            escalera_bloque: values.staircase || 'No indicado',

            ...this.budgetDetails(),
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
        clearTimeout(this.addressTimer);
        this.addressController?.abort();
        this.addressSearchVersion++;
        this.addressSuggestions.set([]);
        this.addressSearchStatus.set('idle');
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
    clearTimeout(this.addressTimer);
    this.addressSearchVersion++;
    this.addressController?.abort();
    this.controller?.abort();
  }
}