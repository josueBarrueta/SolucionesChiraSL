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
El login mantiene una sesión durante 8 horas mediante una cookie HttpOnly y sesiones en Atlas.

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

## Gestión del panel

Clientes, trabajos, gastos, facturas internas y configuración se guardan
mediante rutas privadas `/api/gestion/*`. La API existente de encuestas se mantiene.
Las colecciones se crean al guardar el primer registro; `server/index.mjs` crea sus índices.
No hay borrado definitivo: se archivan y restauran registros. Las facturas confirmadas son inmutables.

Una encuesta aceptada o finalizada crea un cliente (por correo normalizado) y un trabajo vinculado.
Para solicitudes anteriores usa **Sincronizar solicitudes** en Clientes o Trabajos.
Repetir la sincronización no duplica registros. Las fechas y notas actualizadas desde una encuesta
se propagan cuando el propietario no ha personalizado ese campo en el trabajo.
Los trabajos manuales y los importados aparecen en Agenda, Resumen e Informes.

Presupuestos y facturas se calculan en céntimos, con redondeo por concepto y por impuesto.
Los datos fiscales, condiciones y el IVA predeterminado se rellenan en Configuración;
el IVA no se inventa. La moneda es EUR. La impresión abre una vista del documento guardado,
con opción de imprimir o guardar en PDF desde el navegador; las notas internas no se imprimen.

**Facturas es control interno**, según el alcance elegido por el propietario. No es un sistema
certificado de emisión fiscal ni incluye comunicaciones con la administración tributaria.
Puede anotarse la referencia de una factura externa. Confirmar asigna una referencia interna,
fija los importes y permite registrar pagos parciales sin superar el saldo pendiente.
Los informes distinguen facturado, cobrado y pendiente; cobros menos gastos no es beneficio contable.
Los justificantes de gastos se referencian por su nombre o ubicación, sin almacenar archivos adjuntos.

El cambio de contraseña comprueba la contraseña actual y guarda un hash con sal en `credenciales`;
el hash inicial del entorno se usa solo hasta el primer cambio. Todas las sesiones anteriores quedan
invalidadas al cambiar la contraseña y hay que volver a iniciar sesión. No se muestra el hash en las rutas de configuración.

### Publicar esta actualización

Servicio existente: `soluciones-chira-api` en Render, rama `main`, directorio `paginaChira`.
El despliegue automático está desactivado. Una vez que los cambios estén publicados en GitHub,
selecciona **Manual Deploy → Deploy latest commit** en ese servicio. No cambies los secretos.
El comando existente `npm ci --omit=dev --ignore-scripts` instala las dependencias del servidor;
el arranque sigue siendo `npm run server:production`.
Publica también el frontend con su flujo de GitHub Pages para que aparezcan las nuevas pantallas.
Comprueba `/api/health` y prueba una entrada manual y la sincronización de una solicitud aceptada.

Las pruebas HTTP usan una base temporal en memoria. No insertan datos de prueba en MongoDB real.
La revisión local incluye alta de cliente en navegador y compilación del frontend.
Si la caché nativa de Angular falla en este Mac, `CI=1 NG_BUILD_MAX_WORKERS=1 NG_BUILD_PARALLEL_TS=0 npm run build`
permite compilar sin esa caché; no es necesario cambiar la configuración del alojamiento.

## Flujo desde la encuesta

Cada envío crea automáticamente un cliente (reutilizado por correo) y un trabajo pendiente
vinculado a la encuesta. Los reintentos no duplican el trabajo. Las encuestas activas
anteriores se importan la primera vez que se consultan clientes o trabajos tras arrancar.
Las respuestas específicas se incluyen en la ficha; los campos completados manualmente
no se sobrescriben al sincronizar.

En Clientes y Trabajos se puede abrir WhatsApp o correo. La empresa completa los datos
faltantes y asigna la fecha; la Agenda utiliza esa fecha. Finalizar un trabajo actualiza
también la encuesta y permite abrir «Preparar / ver factura», que reutiliza una factura
activa vinculada o prepara un borrador con cliente y concepto. Precio e IVA se completan
antes de guardar. La ficha de trabajo y el registro interno de factura se pueden imprimir
o guardar como PDF desde el navegador. Se mantiene el alcance de facturación interna
existente; esta modificación no implementa un sistema de emisión fiscal.

Presupuestos y Equipo salen del menú principal; sus datos y rutas existentes se conservan.
Gastos sigue siendo manual e Informes resume solicitudes, trabajos, facturas y gastos.
Resumen, Encuestas y las listas de gestión se refrescan cada 30 segundos mientras están
visibles; la actualización no interrumpe una ficha abierta.

## Panel de gestión actualizado

La navegación se organiza en General (Resumen, Clientes, Agenda), Servicios
(Solicitudes, Trabajos), Gestión (Facturas, Gastos, Informes) y Empresa · Ajustes
(Configuración). La encuesta sigue creando un cliente y un trabajo vinculados.

Facturas permite preparar borradores desde trabajos finalizados o manualmente.
La emisión exige razón social, NIF, domicilio y serie de la empresa, así como los
datos fiscales del cliente. Conserva los datos al emitir y asigna el siguiente
número libre. MongoDB Atlas confirma conjuntamente el número, la factura y el
registro de emisión mediante una transacción. Los registros internos antiguos
mantienen su referencia y sus pagos. No existe conexión con la AEAT.

Gastos incorpora proveedor, estado pagado, IVA del justificante (opcional) y
un adjunto PDF/JPG/PNG/WebP de hasta 300 KB. Los adjuntos se validan en el servidor.
Informes exporta CSV para gestoría y gastos, además de PDF desde la impresión;
distingue fecha de factura y fecha de pago y no suma los trabajos como ventas.

En desarrollo se puede configurar LOCAL_ADMIN_PASSWORD_HASH en el archivo .env
privado. Sustituye únicamente el acceso local y no cambia las credenciales de
la base de datos; no se utiliza cuando NODE_ENV=production. Mientras esté activo,
la contraseña local se cambia desde ese archivo y no desde el panel.

## Encuesta sencilla y seguimiento de clientes

Las encuestas de versión 3 crean la ficha del cliente y una solicitud pendiente,
con un vínculo estable `clienteId`. Los reenvíos con la misma clave no se duplican.
Una nueva solicitud del mismo correo se añade al historial de esa ficha, sin
sobrescribir los datos que el propietario haya editado. Los formularios antiguos
conservan su compatibilidad.

En Solicitudes, «Confirmar y preparar trabajo» acepta la solicitud y crea su trabajo
vinculado una sola vez. En Trabajos se completan descripción, tareas, precio acordado
sin IVA y fecha prevista; esta última puede quedar vacía hasta programarlo.
Los trabajos con fecha aparecen en Agenda; los no fechados se muestran pendientes
de programar. Al preparar la factura se propone el precio acordado del trabajo.
Clientes muestra servicios solicitados e historiales de solicitudes, trabajos y
facturas; también mantiene las notas internas y los accesos a correo y WhatsApp.

## Facturas: edición completa en una pantalla

Facturas utiliza un editor propio con datos fiscales visibles. Desde un trabajo
se proponen cliente, concepto y precio sin IVA; también permite crear facturas
manuales y dar de alta un cliente sin salir del editor. Los datos fiscales del
borrador se guardan en `clienteFiscal` y pueden reutilizarse en facturas siguientes,
sin alterar la ficha general ni las facturas emitidas.

«Guardar borrador» vuelve a la lista. En facturas de trabajos, «Guardar y ver
factura» guarda y abre la vista previa. «Guardar y emitir» guarda primero los datos
actuales y solicita la confirmación en un diálogo independiente, con la versión
guardada del documento. La emisión comprueba que el borrador no haya cambiado.
Tras emitir se puede imprimir, guardar como PDF o registrar un cobro. La lista
permite acceder directamente a vista previa, emisión, reimpresión y archivo de
borradores. Los trabajos para facturar se muestran independientemente del periodo
seleccionado para consultar las facturas.

## Documento de factura A4

La vista previa de las facturas se abre dentro del panel, en un visor de impresión
con el formato A4 de Jofemar adaptado a Chira: logo y emisor a la izquierda, cliente
a la derecha, número y fechas, conceptos con precios netos e importes con IVA,
desglose por tipo impositivo y total. La referencia del trabajo sustituye a la del
recibo. Las notas internas no se imprimen; sí las condiciones y el IBAN configurado.
El visor espera a que se cargue el logo antes de abrir la impresión. Las facturas
emitidas usan sus datos guardados y los borradores se identifican como tales.
Las comprobaciones del documento se incluyen en `npm run test:server`.

## Flujo de facturación equivalente a Jofemar

La pantalla de facturas tiene su propio controlador y un editor dentro de la página,
sin depender del formulario genérico de gestión. Mantiene el selector de periodo
con aplicación explícita, resúmenes de borradores y emitidas, trabajos de origen,
listado con búsqueda por cliente/NIF/referencia y acciones de emisión, reimpresión,
edición, archivo y restauración. Los datos de un cliente nuevo se pueden escribir
directamente y se crea o reutiliza su ficha al guardar.

Las observaciones visibles (`observaciones`) se imprimen; las notas internas no.
Después de emitir se abre automáticamente el visor A4. Todas las entradas a vista
previa y reimpresión usan el mismo generador, tanto para las facturas anteriores
como para las nuevas, y respetan los datos fiscales guardados al emitir.
El guardado y la emisión admiten `expectedUpdatedAt` para rechazar versiones antiguas
con una respuesta 409; las confirmaciones repetidas de una factura ya emitida son
idempotentes y no asignan otro número. Los registros internos anteriores mantienen
su naturaleza y no se presentan como nuevas facturas emitidas.

## Solicitudes manuales

Solicitudes incorpora «Añadir solicitud» para elegir un cliente activo o crear una
ficha desde el formulario. Permite seleccionar servicios, canal de contacto
(Teléfono, WhatsApp, Presencial u Otro), descripción y notas internas. Se guarda
siempre como Nueva, sin fecha ni trabajo confirmado. Después usa el mismo flujo
de aceptación, trabajos, agenda y facturación que una encuesta pública.

`POST /api/gestion/solicitudes` exige sesión y una clave `Idempotency-Key`. La clave
se conserva al reintentar; el servidor evita repetir la solicitud y la ficha del
cliente. Las fichas existentes se reutilizan por identificador o correo y no se
sobrescriben. La numeración comparte el contador de solicitudes de la web.
