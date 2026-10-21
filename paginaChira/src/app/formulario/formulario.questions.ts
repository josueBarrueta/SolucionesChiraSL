export interface ServiceQuestion {
  name: string;
  label: string;
  placeholder: string;
  type: 'text' | 'select' | 'number';
  required?: boolean;
  maxLength?: number;
  options?: string[];
  pattern?: string;
}
export interface ServiceAddress {
  prefix: string;
  label: string;
  fields: ServiceQuestion[];
}
export interface ServiceQuestions {
  slug: string;
  service: string;
  fields: ServiceQuestion[];
  addresses: ServiceAddress[];
  items: { label: string; singular: string; placeholder: string; extraLabel?: string };
}
export const MAX_SERVICE_ITEMS = 100;
export const ADDRESS_FIELDS: ServiceQuestion[] = [
  {
    name: 'locality',
    label: 'Localidad / municipio',
    placeholder: 'Ej.: Valencia',
    type: 'text',
    required: true,
  },
  {
    name: 'street',
    label: 'Calle o vía',
    placeholder: 'Nombre de la calle',
    type: 'text',
    required: true,
  },
  {
    name: 'number',
    label: 'Número',
    placeholder: 'Ej.: 24 o Sin número',
    type: 'text',
    required: true,
  },
  {
    name: 'postcode',
    label: 'Código postal',
    placeholder: '5 dígitos',
    type: 'text',
    required: true,
    pattern: '^\\d{5}$',
  },
  {
    name: 'floor',
    label: 'Piso / planta',
    placeholder: 'Ej.: 3.º, Bajo o A pie de calle',
    type: 'text',
    required: true,
  },
  { name: 'door', label: 'Puerta', placeholder: 'Ej.: B o 7 (opcional)', type: 'text' },
  { name: 'staircase', label: 'Escalera / bloque', placeholder: 'Opcional', type: 'text' },
  {
    name: 'lift',
    label: 'Ascensor',
    placeholder: '',
    type: 'select',
    required: true,
    options: ['Sí', 'No', 'No aplica'],
  },
  {
    name: 'access',
    label: 'Indicaciones de acceso',
    placeholder: 'Entrada, aparcamiento o dificultades de acceso (opcional)',
    type: 'text',
  },
];
function address(prefix: string, label: string): ServiceAddress {
  return {
    prefix,
    label,
    fields: ADDRESS_FIELDS.map((f) => ({
      ...f,
      maxLength:
        (
          {
            locality: 120,
            street: 120,
            number: 30,
            postcode: 5,
            floor: 30,
            door: 30,
            staircase: 40,
          } as Record<string, number>
        )[f.name] ?? 300,
      name: `${prefix}_${f.name}`,
    })),
  };
}
function field(
  name: string,
  label: string,
  placeholder: string,
  type: ServiceQuestion['type'] = 'text',
  required = false,
  options?: string[],
): ServiceQuestion {
  return { name, label, placeholder, type, required, options };
}
export const SERVICE_QUESTIONS: ServiceQuestions[] = [
  {
    slug: 'portes',
    service: 'Portes',
    fields: [],
    addresses: [
      address('portes_origin', 'Dirección de recogida'),
      address('portes_destination', 'Dirección de entrega'),
    ],
    items: {
      label: 'Número de objetos a transportar',
      singular: 'Objeto',
      placeholder: 'Ej.: sofá, lavadora o mesa',
      extraLabel: 'Medidas y peso aproximados (opcional)',
    },
  },
  {
    slug: 'montaje',
    service: 'Montaje de muebles',
    fields: [
      field('montaje_available', '¿Los muebles ya están en la ubicación?', '', 'select', false, [
        'Sí',
        'No',
      ]),
    ],
    addresses: [address('montaje_location', 'Dirección del montaje')],
    items: {
      label: 'Número de muebles a montar',
      singular: 'Mueble',
      placeholder: 'Ej.: armario, cama o estantería',
      extraLabel: 'Marca o modelo (opcional)',
    },
  },
  {
    slug: 'mudanzas',
    service: 'Mudanzas',
    fields: [
      field('mudanzas_space', 'Tipo de espacio', '', 'select', true, [
        'Vivienda',
        'Oficina',
        'Local',
        'Trastero',
        'Otro',
      ]),
      field('mudanzas_boxes', 'Número aproximado de cajas', 'Opcional', 'number'),
      field('mudanzas_surface', 'Superficie aproximada (m²)', 'Opcional', 'number'),
      field('mudanzas_rooms', 'Número de habitaciones', 'Opcional', 'number'),
    ],
    addresses: [
      address('mudanzas_origin', 'Dirección de origen'),
      address('mudanzas_destination', 'Dirección de destino'),
    ],
    items: {
      label: 'Número de muebles u objetos grandes',
      singular: 'Mueble u objeto',
      placeholder: 'Ej.: sofá, cama o frigorífico',
      extraLabel: 'Medidas aproximadas (opcional)',
    },
  },
  {
    slug: 'vaciados',
    service: 'Vaciados',
    fields: [
      field('vaciados_space', 'Tipo de espacio', '', 'select', true, [
        'Vivienda',
        'Local',
        'Trastero',
        'Oficina',
        'Otro',
      ]),
      field('vaciados_mode', '¿Qué necesitas vaciar?', '', 'select', true, [
        'Objetos concretos',
        'Todo el espacio',
      ]),
      field('vaciados_surface', 'Superficie aproximada (m²)', 'Opcional', 'number'),
      field('vaciados_keep', 'Objetos que deben quedarse', 'Opcional'),
    ],
    addresses: [address('vaciados_location', 'Dirección del vaciado')],
    items: {
      label: 'Número de objetos a retirar',
      singular: 'Objeto',
      placeholder: 'Ej.: armario o colchón',
      extraLabel: 'Medidas aproximadas (opcional)',
    },
  },
  {
    slug: 'limpieza',
    service: 'Limpieza',
    fields: [
      field('limpieza_kind', 'Tipo de limpieza', '', 'select', true, [
        'General',
        'A fondo',
        'Después de una mudanza',
        'Fin de obra',
        'Otro',
      ]),
      field('limpieza_surface', 'Superficie aproximada (m²)', 'Opcional', 'number'),
      field('limpieza_condition', 'Estado del espacio', 'Ej.: polvo, grasa o restos de obra'),
      field('limpieza_furnished', '¿Está amueblado?', '', 'select', false, ['Sí', 'No']),
    ],
    addresses: [address('limpieza_location', 'Dirección de la limpieza')],
    items: {
      label: 'Número de estancias o zonas',
      singular: 'Zona',
      placeholder: 'Ej.: cocina, baño o habitación',
    },
  },
  {
    slug: 'pintura',
    service: 'Pintura',
    fields: [
      field('pintura_area', 'Zona a pintar', '', 'select', true, ['Interior', 'Exterior', 'Ambos']),
      field('pintura_surface', 'Superficie aproximada (m²)', 'Opcional', 'number'),
      field(
        'pintura_condition',
        'Estado de las superficies',
        'Ej.: buen estado, manchas o grietas',
      ),
      field('pintura_color', 'Color deseado', 'Opcional'),
    ],
    addresses: [address('pintura_location', 'Dirección del trabajo de pintura')],
    items: {
      label: 'Número de estancias o zonas',
      singular: 'Zona',
      placeholder: 'Ej.: salón o fachada',
      extraLabel: 'Qué pintar: paredes, techo o ambos (opcional)',
    },
  },
  {
    slug: 'derribos',
    service: 'Derribos',
    fields: [
      field('derribos_space', 'Tipo de espacio', '', 'select', true, [
        'Vivienda',
        'Local',
        'Oficina',
        'Otro',
      ]),
      field(
        'derribos_scope',
        'Alcance del derribo',
        'Describe qué necesitas derribar y qué debe conservarse',
        'text',
        true,
      ),
      field('derribos_surface', 'Superficie aproximada (m²)', 'Opcional', 'number'),
      field(
        'derribos_rubble',
        '¿Necesitas consultar la retirada de escombros?',
        '',
        'select',
        true,
        ['Sí, quiero consultarla', 'No', 'No lo sé todavía'],
      ),
      field(
        'derribos_conditions',
        'Condiciones del espacio o documentación disponible',
        'Indica detalles que debamos revisar antes de confirmar el trabajo (opcional)',
      ),
    ],
    addresses: [address('derribos_location', 'Dirección del derribo')],
    items: {
      label: 'Número de elementos o zonas a valorar',
      singular: 'Elemento o zona',
      placeholder: 'Describe el elemento o la zona',
      extraLabel: 'Medidas y material, si los conoces (opcional)',
    },
  },
];
export function serviceUsesItems(
  block: ServiceQuestions,
  details: Record<string, string>,
): boolean {
  return block.slug !== 'vaciados' || details['vaciados_mode'] !== 'Todo el espacio';
}

// Mantiene los envíos del formulario anterior durante la actualización de la web.
export const LEGACY_SERVICE_QUESTIONS: {
  slug: string;
  service: string;
  fields: ServiceQuestion[];
}[] = [
  {
    slug: 'portes',
    service: 'Portes',
    fields: [
      {
        name: 'portes_objects',
        label: 'Objetos que necesitas trasladar',
        placeholder: 'Ej.: un sofá y una lavadora',
        type: 'text',
      },
      {
        name: 'portes_origin',
        label: 'Localidad de recogida',
        placeholder: 'Ej.: Valencia',
        type: 'text',
      },
      {
        name: 'portes_destination',
        label: 'Localidad de entrega',
        placeholder: 'Ej.: Torrent',
        type: 'text',
      },
      {
        name: 'portes_access',
        label: 'Plantas y accesos',
        placeholder: 'Indica plantas y si hay ascensor en ambos lugares',
        type: 'text',
      },
    ],
  },
  {
    slug: 'montaje',
    service: 'Montaje de muebles',
    fields: [
      {
        name: 'montaje_furniture',
        label: 'Tipo de muebles',
        placeholder: 'Ej.: armario, cama o escritorio',
        type: 'text',
      },
      {
        name: 'montaje_quantity',
        label: 'Cantidad de muebles',
        placeholder: 'Ej.: 2',
        type: 'text',
      },
      {
        name: 'montaje_model',
        label: 'Marca o modelo',
        placeholder: 'Si lo conoces, indica la referencia',
        type: 'text',
      },
    ],
  },
  {
    slug: 'mudanzas',
    service: 'Mudanzas',
    fields: [
      {
        name: 'mudanzas_origin',
        label: 'Localidad de origen',
        placeholder: 'Ej.: Valencia',
        type: 'text',
      },
      {
        name: 'mudanzas_destination',
        label: 'Localidad de destino',
        placeholder: 'Ej.: Madrid',
        type: 'text',
      },
      {
        name: 'mudanzas_volume',
        label: 'Qué necesitas trasladar',
        placeholder: 'Ej.: vivienda de 3 habitaciones',
        type: 'text',
      },
      {
        name: 'mudanzas_originFloor',
        label: 'Planta en origen',
        placeholder: 'Ej.: 3.º',
        type: 'text',
      },
      {
        name: 'mudanzas_originLift',
        label: 'Ascensor en origen',
        placeholder: '',
        type: 'select',
      },
      {
        name: 'mudanzas_destinationFloor',
        label: 'Planta en destino',
        placeholder: 'Ej.: bajo',
        type: 'text',
      },
      {
        name: 'mudanzas_destinationLift',
        label: 'Ascensor en destino',
        placeholder: '',
        type: 'select',
      },
    ],
  },
  {
    slug: 'vaciados',
    service: 'Vaciados',
    fields: [
      {
        name: 'vaciados_space',
        label: 'Tipo de espacio',
        placeholder: 'Ej.: vivienda, local o trastero',
        type: 'text',
      },
      {
        name: 'vaciados_objects',
        label: 'Objetos que hay que retirar',
        placeholder: 'Describe los objetos y su cantidad aproximada',
        type: 'text',
      },
      {
        name: 'vaciados_access',
        label: 'Acceso al espacio',
        placeholder: 'Indica planta y si hay ascensor',
        type: 'text',
      },
    ],
  },
  {
    slug: 'limpieza',
    service: 'Limpieza',
    fields: [
      {
        name: 'limpieza_surface',
        label: 'Superficie aproximada',
        placeholder: 'Ej.: 90 m²',
        type: 'text',
      },
      {
        name: 'limpieza_rooms',
        label: 'Estancias o zonas',
        placeholder: 'Ej.: 3 habitaciones, cocina y 2 baños',
        type: 'text',
      },
      {
        name: 'limpieza_kind',
        label: 'Tipo de limpieza',
        placeholder: 'Ej.: limpieza a fondo o después de una mudanza',
        type: 'text',
      },
    ],
  },
  {
    slug: 'pintura',
    service: 'Pintura',
    fields: [
      {
        name: 'pintura_surface',
        label: 'Superficie aproximada',
        placeholder: 'Ej.: 80 m² de paredes',
        type: 'text',
      },
      {
        name: 'pintura_area',
        label: 'Zona a pintar',
        placeholder: 'Ej.: interior, exterior o ambos',
        type: 'text',
      },
      {
        name: 'pintura_condition',
        label: 'Estado de las superficies',
        placeholder: 'Ej.: buen estado, manchas o grietas',
        type: 'text',
      },
    ],
  },
];
