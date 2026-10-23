# Soluciones Chira

Web pública y panel de gestión de Soluciones Chira SL, con Angular y un servidor Node.js.
Requiere Node.js 24.22.1 o una actualización posterior de la rama 24 LTS.

## Trabajar en local

Instala las dependencias con `npm ci`. Configura la conexión y el acceso del servidor
siguiendo [server/README.md](server/README.md), con las variables de `.env.example`
en un archivo privado `.env`.

En dos terminales, ejecuta:

```sh
npm run server
```

```sh
npm start
```

La web se abre en `http://localhost:4200`. El servidor usa el puerto 3000 por defecto;
el proxy de desarrollo conecta la web con la API.

## Organización del código

- `src/app/app.routes.ts`: rutas públicas y del panel.
- `src/app/home`, `servicios`, `servicio`, `nosotros` y `contacto`: web pública.
- `src/app/formulario`: encuesta pública y definiciones compartidas con el servidor.
- `src/app/admin`: estructura y navegación del panel.
- `src/app/adminApartados`: clientes, solicitudes, trabajos, agenda, facturas, gastos,
  informes y configuración. `gestion` contiene la interfaz compartida de gestión.
- `src/app/adminApartados/adminFacturas/invoice-document.ts`: documento imprimible de factura.
- `src/app/shared`: componentes, utilidades y conexión con la API compartidos.
- `src/app/login`: autenticación y protección de rutas.
- `server`: API, reglas de gestión, acceso a datos, seguridad y pruebas.
- `scripts`: configuración de la API y preparación de rutas para publicación estática.
- `public`: imágenes, vídeos y configuración pública. Algunos vídeos se referencian
  mediante nombres construidos en el código; `fuentes.json` documenta la procedencia
  de las fotografías.

## Formato y comprobaciones

```sh
npm run format
npm run format:check
npm run build
node --test server/*.test.mjs scripts/*.test.mjs
```

Prettier aplica el mismo formato al código TypeScript, JavaScript, HTML, estilos y
configuración. La configuración está en `package.json`; `.prettierignore` excluye
los recursos, secretos, dependencias y archivos generados.

Las pruebas del servidor usan datos de prueba en memoria y no borran la base de datos.
Los archivos de `dist`, `.angular` y `node_modules` son generados y están excluidos de Git.

## SEO técnico

Los títulos, descripciones, datos públicos del negocio y dirección del sitio se mantienen en
`src/app/seo/seo.config.ts`. El servicio `SeoService` los actualiza al navegar, incluyendo
canonical, Open Graph, Twitter Cards y datos estructurados de empresa, servicios y navegación.
No se han añadido una dirección postal, horarios, reseñas ni valoraciones sin confirmar.

`npm run build` genera 11 páginas informativas con contenido HTML completo. El formulario y
el panel conservan su funcionamiento en el navegador. La publicación añade metadatos propios
al formulario, `noindex` al login y a todas las rutas de administración, `sitemap.xml` y
`robots.txt`. El verificador del proceso de compilación comprueba estos resultados.
La autenticación continúa protegiendo los datos; `noindex` es una indicación para buscadores.

La configuración actual apunta a `https://josuebarrueta.github.io/SolucionesChiraSL/`.
El comando de publicación existente mantiene las páginas prerenderizadas y las rutas privadas.
Para un dominio propio, actualizar `SITE_URL` y el `--base-href` usado en la compilación.

En GitHub Pages bajo `/SolucionesChiraSL/`, el archivo `robots.txt` generado queda en una
subcarpeta. Los buscadores solo leen el de la raíz del host: hay que publicarlo en
`https://josuebarrueta.github.io/robots.txt` desde el sitio raíz del propietario, o usar un
dominio propio con la web en `/`. Esto no impide el rastreo por defecto ni afecta a las
indicaciones `noindex` incluidas en las páginas. Véase la
[documentación de Google sobre robots.txt](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt).

Después de publicar, verificar la propiedad en Google Search Console y enviar el sitemap
`https://josuebarrueta.github.io/SolucionesChiraSL/sitemap.xml`. Comprobar las páginas públicas
con la inspección de URLs y los datos estructurados con la prueba de resultados enriquecidos.
La indexación y las posiciones dependen del sitio publicado; estas tareas no se han realizado
desde una cuenta externa. El SEO local puede completarse con una ficha de Google Business
Profile y datos del negocio confirmados.

## Rendimiento de imágenes y vídeos

`npm start` y `npm run build` ejecutan `prepare:assets`, que prepara los iconos sin bloqueo
y las fotografías en WebP a 480 y 960 píxeles,
con una variante de 1440 para la portada. Los originales se conservan. Las variantes
están en `public/images/optimized`, una carpeta generada y excluida de Git.
`npm run optimize:images` permite regenerarlas sin compilar. `ResponsiveImageDirective`
conecta cada imagen con sus variantes y cada plantilla define el tamaño que ocupa.

Los vídeos muestran portadas estáticas y solo conectan el archivo multimedia al ser
visibles y estar activos. Derribos conserva la última imagen mientras prepara la pareja
siguiente. Las portadas se guardan junto a cada vídeo. Si se cambia un vídeo, pueden
regenerarse con `node scripts/generate-video-posters.mjs`, con FFmpeg instalado o su ruta
en `CHIRA_FFMPEG`. La compilación verifica imágenes, portadas y carga aplazada.

GitHub Pages controla las cabeceras de caché de la web publicada. El proyecto no puede
ampliar su duración mediante archivos de configuración de Apache o Nginx; esa mejora
requiere un alojamiento o CDN que permita configurar las cabeceras. Una nueva nota de
PageSpeed debe medirse después de publicar los cambios.
