import { MongoClient } from 'mongodb';
import { createApp } from './app.mjs';

const uri = process.env.MONGODB_URI;
const passwordHash = process.env.ADMIN_PASSWORD_HASH;
const production = process.env.NODE_ENV === 'production';
const origins = (process.env.APP_ORIGINS ?? 'http://localhost:4200').split(',').map(s => s.trim());
if (!uri || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash ?? '')) {
  console.error('Configura MONGODB_URI y ADMIN_PASSWORD_HASH en .env antes de iniciar el servidor.');
  process.exit(1);
}
if (production && origins.some(origin => !origin.startsWith('https://'))) {
  console.error('La configuración de producción requiere APP_ORIGINS con HTTPS.');
  process.exit(1);
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE ?? 'soluciones_chira');
  await db.command({ ping: 1 });
  await db.collection('encuestas').createIndex({ submissionKey: 1 }, { unique: true });
  await db.collection('encuestas').createIndex({ createdAt: -1 });
  await db.collection('sesiones').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('clientes').createIndex({ origenEmail: 1 }, { unique: true, partialFilterExpression: { origenEmail: { $type: 'string' } } });
  await db.collection('trabajos').createIndex({ encuestaId: 1 }, { unique: true, partialFilterExpression: { encuestaId: { $type: 'string', $gt: '' } } });
  for (const name of ['clientes', 'trabajos', 'gastos', 'facturas']) await db.collection(name).createIndex({ createdAt: -1 });
  const app = createApp({ db, passwordHash, origins, secureCookies: production,
    webDirectory: process.env.WEB_DIRECTORY || null,
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@chira.local' });
  app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1', () => {
    console.log('Servidor de Chira preparado. Base de datos: soluciones_chira.');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.close(async () => { await client.close(); process.exit(0); }));
} catch {
  console.error('No se pudo conectar con Atlas. Revisa la conexión privada, el usuario y el acceso de red.');
  await client.close(); process.exit(1);
}
