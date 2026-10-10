export interface ServiceQuestion {
  name: string;
  label: string;
  placeholder: string;
  type: 'text' | 'select';
}

export interface ServiceQuestions {
  slug: string;
  service: string;
  fields: ServiceQuestion[];
}

export const SERVICE_QUESTIONS: ServiceQuestions[] = [
  {
    slug: 'portes',
    service: 'Portes',
    fields: [
      {
        name: 'portes_objects',
        label: 'Objetos que necesitas trasladar',
        placeholder: 'Ej.: un sofá y una lavadora',
        type: 'text'
      },
      {
        name: 'portes_origin',
        label: 'Localidad de recogida',
        placeholder: 'Ej.: Valencia',
        type: 'text'
      },
      {
        name: 'portes_destination',
        label: 'Localidad de entrega',
        placeholder: 'Ej.: Torrent',
        type: 'text'
      },
      {
        name: 'portes_access',
        label: 'Plantas y accesos',
        placeholder: 'Indica plantas y si hay ascensor en ambos lugares',
        type: 'text'
      },
    ]
  },
  {
    slug: 'montaje',
    service: 'Montaje de muebles',
    fields: [
      {
        name: 'montaje_furniture',
        label: 'Tipo de muebles',
        placeholder: 'Ej.: armario, cama o escritorio',
        type: 'text'
      },
      {
        name: 'montaje_quantity',
        label: 'Cantidad de muebles',
        placeholder: 'Ej.: 2',
        type: 'text'
      },
      {
        name: 'montaje_model',
        label: 'Marca o modelo',
        placeholder: 'Si lo conoces, indica la referencia',
        type: 'text'
      },
    ]
  },
  {
    slug: 'mudanzas',
    service: 'Mudanzas',
    fields: [
      {
        name: 'mudanzas_origin',
        label: 'Localidad de origen',
        placeholder: 'Ej.: Valencia',
        type: 'text'
      },
      {
        name: 'mudanzas_destination',
        label: 'Localidad de destino',
        placeholder: 'Ej.: Madrid',
        type: 'text'
      },
      {
        name: 'mudanzas_volume',
        label: 'Qué necesitas trasladar',
        placeholder: 'Ej.: vivienda de 3 habitaciones',
        type: 'text'
      },
      {
        name: 'mudanzas_originFloor',
        label: 'Planta en origen',
        placeholder: 'Ej.: 3.º',
        type: 'text'
      },
      {
        name: 'mudanzas_originLift',
        label: 'Ascensor en origen',
        placeholder: '',
        type: 'select'
      },
      {
        name: 'mudanzas_destinationFloor',
        label: 'Planta en destino',
        placeholder: 'Ej.: bajo',
        type: 'text'
      },
      {
        name: 'mudanzas_destinationLift',
        label: 'Ascensor en destino',
        placeholder: '',
        type: 'select'
      },
    ]
  },
  {
    slug: 'vaciados',
    service: 'Vaciados',
    fields: [
      {
        name: 'vaciados_space',
        label: 'Tipo de espacio',
        placeholder: 'Ej.: vivienda, local o trastero',
        type: 'text'
      },
      {
        name: 'vaciados_objects',
        label: 'Objetos que hay que retirar',
        placeholder: 'Describe los objetos y su cantidad aproximada',
        type: 'text'
      },
      {
        name: 'vaciados_access',
        label: 'Acceso al espacio',
        placeholder: 'Indica planta y si hay ascensor',
        type: 'text'
      },
    ]
  },
  {
    slug: 'limpieza',
    service: 'Limpieza',
    fields: [
      {
        name: 'limpieza_surface',
        label: 'Superficie aproximada',
        placeholder: 'Ej.: 90 m²',
        type: 'text'
      },
      {
        name: 'limpieza_rooms',
        label: 'Estancias o zonas',
        placeholder: 'Ej.: 3 habitaciones, cocina y 2 baños',
        type: 'text'
      },
      {
        name: 'limpieza_kind',
        label: 'Tipo de limpieza',
        placeholder: 'Ej.: limpieza a fondo o después de una mudanza',
        type: 'text'
      },
    ]
  },
  {
    slug: 'pintura',
    service: 'Pintura',
    fields: [
      {
        name: 'pintura_surface',
        label: 'Superficie aproximada',
        placeholder: 'Ej.: 80 m² de paredes',
        type: 'text'
      },
      {
        name: 'pintura_area',
        label: 'Zona a pintar',
        placeholder: 'Ej.: interior, exterior o ambos',
        type: 'text'
      },
      {
        name: 'pintura_condition',
        label: 'Estado de las superficies',
        placeholder: 'Ej.: buen estado, manchas o grietas',
        type: 'text'
      },
    ]
  },
];
