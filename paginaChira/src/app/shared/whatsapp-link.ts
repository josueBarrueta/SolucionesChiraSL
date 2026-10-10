export function whatsappLink(hour: number = new Date().getHours()): string {
  const greeting = hour >= 6 && hour < 12
    ? 'buenos días'
    : hour >= 12 && hour < 21
      ? 'buenas tardes'
      : 'buenas noches';

  const message =
    `Hola, ${greeting}. Me gustaría consultarles sobre uno de los servicios que ofrecen en su página web.`;

  return `https://wa.me/34610928521?text=${encodeURIComponent(message)}`;
}
