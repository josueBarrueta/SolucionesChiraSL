# Servidor de Soluciones Chira

Base de datos: `soluciones_chira` en Atlas. Colecciones: `encuestas`, `sesiones` y `contadores`.
El servidor crea los índices necesarios al arrancar; la colección de encuestas ya está creada en Atlas.
Requiere Node.js 24 o superior. La web puede seguir en GitHub Pages y llamar al servidor externo autorizado.

## Configuración pendiente

El archivo privado `.env` está excluido de Git. Ya contiene la configuración del propietario
con la contraseña facilitada para el login, almacenada como hash con sal, no en texto plano.
Completa **solo en ese archivo** `MONGODB_URI` con la conexión de Atlas.
No copies esa conexión en archivos de Angular ni en el chat.

Conviene usar un usuario de base de datos propio, por ejemplo `chira_app`, con permiso
`readWrite` limitado a `soluciones_chira`, y autorizar únicamente la IP del servidor.
Crear el usuario o cambiar permisos de red en Atlas requiere hacerlo con el dueño.
No se ha creado ningún usuario ni se ha cambiado el acceso de red.

## Probar en el ordenador

Desde `paginaChira`, en una terminal:

```sh
npm run server
```

En otra terminal:

```sh
npm start
```

Abre `/formulario`, envía una solicitud y entra en `/login` para consultar `/admin/encuestas`.
Las solicitudes se guardan en Atlas, no en el navegador. El servidor tiene que estar ejecutándose.
Las encuestas empiezan vacías: los antiguos ejemplos no se migran a datos reales.
Los cambios del modal se guardan solo al pulsar Guardar o Archivar; cerrar la ficha descarta ediciones.
El login mantiene una sesión durante 12 horas mediante una cookie HttpOnly y sesiones en Atlas.

## Publicar

GitHub Pages por sí solo no ejecuta este servidor. Antes de publicar esta versión es necesario
alojar el servidor Node bajo HTTPS y configurar su URL pública y los orígenes autorizados.
El despliegue existente de GitHub Pages no ha sido cambiado ni se ha publicado esta versión.
Si se publica este código solo en Pages, el formulario y el login no encontrarán el API.

Ejemplo de configuración en el alojamiento de Node:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `APP_ORIGINS=https://tu-dominio-real` (sin barra final)
- `WEB_DIRECTORY=dist/paginaChira/browser`
- `PORT` proporcionado por el alojamiento.
- `MONGODB_URI`, `MONGODB_DATABASE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` privados.

Compila con `npm run build` y arranca con `npm run server`.
Asegúrate de que el alojamiento conserva la carpeta compilada, admite Node 24 y tiene
una IP autorizada en Atlas. Para producción, cambia la contraseña de prueba, que estaba
incluida en la versión inicial del frontend, y configura su nuevo hash solo en el servidor.

## Pruebas y límites

```sh
npm run test:server
```

Las pruebas ejercitan el API por HTTP con un repositorio en memoria: validación, login,
cookies, permisos, reintentos, edición y logout. La conexión real con Atlas debe verificarse
cuando se complete `MONGODB_URI`; los tests no sustituyen esa comprobación.
La limitación de intentos usa la IP de conexión y memoria del proceso; detrás de un proxy
puede compartir cuota entre clientes. Para más tráfico, configura protección y límites en el alojamiento.

El formulario ahora guarda directamente en Atlas. No se envían notificaciones de correo
ni se importan solicitudes antiguas de Web3Forms. WhatsApp y Correo abren la herramienta
correspondiente para que el dueño revise y envíe el mensaje.

## GitHub Pages con servidor externo

La ruta de la web definida por el repositorio es `https://josuebarrueta.github.io/SolucionesChiraSL/`.
No se cambia esa ruta. El servidor recibe `APP_ORIGINS=https://josuebarrueta.github.io`.
CORS solo permite los orígenes configurados; no se permiten todos los dominios.
Para dominios separados, el login usa una sesión de servidor con un token en memoria del navegador,
que no se guarda en localStorage ni sessionStorage. Recargar la página requiere volver a iniciar sesión
en esta modalidad. En el mismo dominio, sigue disponible la cookie HttpOnly.

La URL pública del API se carga desde `public/api-config.json`. El archivo no contiene secretos.
En GitHub, configura una variable del repositorio llamada `CHIRA_API_URL` con la URL HTTPS
real del servidor, sin `/api` al final. El workflow genera la configuración al compilar.
Si falta esa variable, la publicación se detiene antes de sustituir la web existente.
El proxy de `localhost` se usa únicamente al ejecutar `npm start` en el ordenador.

### Preparación para Render

Se ha preparado `paginaChira/server/render.yaml` como plantilla de prueba. En Render,
la ruta del Blueprint es esa ruta completa dentro del repositorio. No se ha creado ningún servicio.
El plan gratuito está indicado para pruebas y puede suspenderse por inactividad; para la web
de la empresa, el dueño debe elegir un plan adecuado antes de desplegar.
Configura las credenciales privadas de Atlas y el hash del dueño en Render, autoriza en Atlas
las direcciones de salida de ese servicio y prueba `/api/health`. Después copia la URL
real en `CHIRA_API_URL` de GitHub y publica el frontend.

No publiques todavía: faltan el alojamiento activo, la conexión real de Atlas y una encuesta
de prueba enviada desde la URL pública. La plantilla no inventa una URL del API.

Documentación: https://render.com/docs/deploy-node-express-app y https://render.com/docs/free
