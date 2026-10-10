export interface AddressFeature {
  properties: {
    type?: string;
    street?: string;
    name?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    countrycode?: string;
    postcode?: string;
  };
}

export function addressSuggestion(feature: AddressFeature, typedNumber?: string) {
  const address = feature.properties;
  const name = address.street ?? address.name;
  const houseNumber = address.housenumber?.trim();
  const normalize = (value: string) => value.replace(/\s/g, '').toLowerCase();

  if (
    !name || address.countrycode?.toUpperCase() !== 'ES' ||
    (typedNumber && houseNumber && normalize(typedNumber) !== normalize(houseNumber))
  ) {
    return null;
  }

  // Un código de calle no confirma el código de un portal concreto.
  const isHouse = address.type === 'house' && Boolean(houseNumber);
  const postcode = isHouse && /^\d{5}$/.test(address.postcode ?? '')
    ? address.postcode!
    : '';

  return {
    value: [name, houseNumber ?? typedNumber].filter(Boolean).join(' '),
    locality: address.city ?? address.town ?? address.village ?? '',
    postcode
  };
}
