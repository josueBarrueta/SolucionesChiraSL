import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export function pagePaths(source) {
  const file = ts.createSourceFile('app.routes.ts', source, ts.ScriptTarget.Latest, true);
  let routes;
  const findRoutes = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'routes') routes = node.initializer;
    ts.forEachChild(node, findRoutes);
  };
  findRoutes(file);
  if (!routes || !ts.isArrayLiteralExpression(routes)) throw new Error('No se encontró la lista de rutas.');
  const paths = new Set();
  const collect = (entries, parent = '') => {
    for (const entry of entries.elements) {
      if (!ts.isObjectLiteralExpression(entry)) throw new Error('Formato de ruta no compatible.');
      const property = name => entry.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(file).replace(/['"]/g, '') === name)?.initializer;
      const path = property('path');
      if (!path || !ts.isStringLiteral(path)) throw new Error('La ruta debe tener un path literal.');
      if (path.text.includes('*')) continue;
      if (path.text.includes(':')) throw new Error('Las rutas dinámicas requieren una lista de páginas para publicar.');
      const fullPath = [parent, path.text].filter(Boolean).join('/');
      if (!property('redirectTo')) paths.add(fullPath);
      const children = property('children');
      if (children) {
        if (!ts.isArrayLiteralExpression(children)) throw new Error('La lista de rutas hijas debe ser literal.');
        collect(children, fullPath);
      }
    }
  };
  collect(routes);
  return [...paths];
}

export async function preparePages(output, source) {
  output = resolve(output);
  for (const path of pagePaths(source)) {
    const directory = resolve(output, path);
    const fromOutput = relative(output, directory);
    if (fromOutput.startsWith('..') || isAbsolute(fromOutput)) throw new Error('Ruta fuera del directorio de publicación.');
    if (!path) continue;
    await mkdir(directory, { recursive: true });
    await copyFile(resolve(output, 'index.html'), resolve(directory, 'index.html'));
  }
  await copyFile(resolve(output, 'index.html'), resolve(output, '404.html'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const source = await readFile(new URL('../src/app/app.routes.ts', import.meta.url), 'utf8');
  await preparePages(process.argv[2] ?? 'dist/site/browser', source);
}
