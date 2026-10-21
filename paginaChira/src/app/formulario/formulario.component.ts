import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { ChiraApiService } from '../shared/chira-api.service';
import { SERVICE_QUESTIONS } from './formulario.questions';

@Component({
  selector: 'app-formulario',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './formulario.component.html',
  styleUrls: ['./formulario.component.scss'],
})
export class FormularioComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ChiraApiService);
  private readonly route = inject(ActivatedRoute);
  private submissionKey: string | null = null;
  private submissionPayload = '';
  readonly status = signal<'idle' | 'sending' | 'success' | 'error'>('idle');
  readonly errorMessage = signal('');
  readonly services = [...SERVICE_QUESTIONS.map((block) => block.service), 'Otra consulta'];
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
    'Xirivella',
  ].sort((a, b) => a.localeCompare(b, 'es'));

  readonly countries = this.buildCountries();
  readonly form = this.fb.nonNullable.group({
    services: this.fb.nonNullable.control<string[]>([], Validators.required),
    firstName: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    street: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(140)]],
    number: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)]],
    floor: ['', Validators.maxLength(30)],
    door: ['', Validators.maxLength(30)],
    postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    location: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.pattern(/\S/),
        Validators.maxLength(120),
      ],
    ],
    country: this.fb.nonNullable.control<CountryCode>('ES'),
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    website: [''],
  });
  constructor() {
    this.form.controls.phone.addValidators((control: AbstractControl) => {
      if (!control.value) return null;
      const phone = parsePhoneNumberFromString(
        String(control.value),
        this.form.controls.country.value,
      );
      return phone?.isPossible() &&
        phone.countryCallingCode === getCountryCallingCode(this.form.controls.country.value)
        ? null
        : { phone: true };
    });
    this.form.controls.country.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formatPhoneOnBlur());
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const block = SERVICE_QUESTIONS.find((b) => b.slug === params.get('servicio'));
      if (block) this.form.controls.services.setValue([block.service]);
    });
  }
  get formattedAddress(): string {
    const value = this.form.getRawValue();
    return [
      value.street.trim(),
      value.number.trim(),
      value.floor.trim() ? 'piso ' + value.floor.trim() : '',
      value.door.trim() ? 'puerta ' + value.door.trim() : '',
    ]
      .filter(Boolean)
      .join(', ');
  }
  private buildCountries(): {
    code: CountryCode;
    name: string;
    prefix: string;
  }[] {
    const names = new Intl.DisplayNames(['es'], {
      type: 'region',
    });

    return getCountries()
      .map((code) => ({
        code,
        name: names.of(code) ?? code,
        prefix: getCountryCallingCode(code),
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

    const digitsBeforeCursor = input.value.slice(0, position).replace(/\D/g, '').length;

    const digits = input.value.replace(/\D/g, '');

    const formatted = new AsYouType(this.form.controls.country.value).input(digits);

    this.form.controls.phone.setValue(formatted, {
      emitEvent: false,
    });

    input.value = formatted;

    // Mantiene el cursor junto al dígito que se estaba editando.
    let cursor = 0;
    let count = 0;

    while (cursor < formatted.length && count < digitsBeforeCursor) {
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

    const formatted = new AsYouType(this.form.controls.country.value).input(digits);

    control.setValue(formatted, {
      emitEvent: false,
    });

    control.updateValueAndValidity({
      emitEvent: false,
    });
  }

  async submit(): Promise<void> {
    if (this.status() === 'sending') return;
    this.errorMessage.set('');
    this.status.set('idle');
    const values = this.form.getRawValue();
    for (const key of [
      'firstName',
      'lastName',
      'street',
      'number',
      'floor',
      'door',
      'postalCode',
      'location',
      'email',
    ] as const)
      this.form.controls[key].setValue(values[key].trim(), { emitEvent: false });
    this.formatPhoneOnBlur();
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorMessage.set('Revisa los campos indicados antes de enviar.');
      this.status.set('error');
      return;
    }
    if (this.form.controls.website.value) return;
    const current = this.form.getRawValue(),
      phone = parsePhoneNumberFromString(current.phone, current.country);
    if (!phone) return;
    const payload = { ...current, phone: phone.number, questionnaireVersion: 3 };
    const signature = JSON.stringify(payload);
    if (!this.submissionKey || this.submissionPayload !== signature) {
      this.submissionKey = crypto.randomUUID();
      this.submissionPayload = signature;
    }
    this.status.set('sending');
    try {
      const result = await this.api.request<{ success: boolean }>('/encuestas', 'POST', payload, {
        'Idempotency-Key': this.submissionKey,
      });
      if (!result.success) throw new Error('No se pudo confirmar el envío.');
      this.submissionKey = null;
      this.submissionPayload = '';
      this.form.reset();
      this.status.set('success');
    } catch {
      this.errorMessage.set(
        'No hemos podido confirmar el envío. Conservamos tus datos para que puedas intentarlo de nuevo.',
      );
      this.status.set('error');
    }
  }
  newRequest(): void {
    this.status.set('idle');
    this.errorMessage.set('');
  }
}
