import assert from 'assert';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join, isAbsolute } from 'path';
import * as utility from 'utility';
import * as os from 'os';
import mkdirp from 'mkdirp';

const tmpDir = os.tmpdir();
const initCwd = process.cwd();
const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

export interface FrameworkPathOptions {
  baseDir: string;
  framework: string;
  env?: string;
}

export function getFrameworkOrIedoPath(cwd: string, iedoNames: string[]) {
  iedoNames = iedoNames || ['iedo'];
  const moduleDir = join(cwd, 'node_modules');
  if (!existsSync(moduleDir)) {
    return '';
  }

  const pkgFile = join(cwd, 'package.json');
  if (existsSync(pkgFile)) {
    const pkg = utility.readJSONSync(pkgFile);
    if (pkg.iedo && pkg.iedo.framework) {
      return join(moduleDir, pkg.iedo.framework);
    }
  }

  const names = readdirSync(moduleDir);
  for (const name of names) {
    const pkgFile = join(moduleDir, name, 'package.json');
    if (!existsSync(pkgFile)) {
      continue;
    }
    const pkg = utility.readJSONSync(pkgFile);
    if (pkg.dependencies) {
      for (const iedoName of iedoNames) {
        if (pkg.dependencies[iedoName]) {
          return join(moduleDir, name);
        }
      }
    }
  }

  for (const iedoName of iedoNames) {
    const pkgFile = join(moduleDir, iedoName, 'package.json');
    if (existsSync(pkgFile)) {
      return join(moduleDir, iedoName);
    }
  }

  return '';
}

export function getPlugins(opt: FrameworkPathOptions) {
  const loader = getLoader(opt);
  loader.loadPlugin();
  return loader.allPlugins;
}

export function getLoadUnits(opts: FrameworkPathOptions) {
  const loader = getLoader(opts);
  loader.loadPlugin();
  return loader.getLoadUnits();
}

export function getConfig(opt: FrameworkPathOptions) {
  const loader = getLoader(opt);
  loader.loadPlugin();
  loader.loadConfig();
  return loader.config;
}

export function getFrameworkPath({ framework, baseDir }: FrameworkPathOptions) {
  const pkgPath = join(baseDir, 'package.json');
  assert(existsSync(pkgPath), `${pkgPath} should exists`);

  const moduleDir = join(baseDir, 'node_modules');
  const pkg = utility.readJSONSync(pkgPath);

  if (framework) {
    if (isAbsolute(framework)) {
      assert(existsSync(framework), `${framework} should exists`);
      return framework;
    }

    return assertAndReturn(framework, moduleDir);
  }

  if (pkg.iedo && pkg.iedo.framework) {
    return assertAndReturn(pkg.iedo.framework, moduleDir);
  }

  // use iedo do by default
  return assertAndReturn('iedo', moduleDir);
}

function assertAndReturn(frameworkName: string, moduleDir: string) {
  const moduleDirs = new Set([moduleDir, join(process.cwd(), 'node_modules'), join(initCwd, 'node_modules')]);

  for (const moduleDir of moduleDirs) {
    const frameworkPath = join(moduleDir, frameworkName);
    if (existsSync(frameworkPath)) return frameworkPath;
  }

  throw new Error(`${frameworkName} is not found in ${Array.from(moduleDirs)}`);
}

function noop() {}

function getLoader({ baseDir, framework, env }: FrameworkPathOptions) {
  assert(framework, 'framework should be provided');
  assert(existsSync(framework), `${framework} should exists`);

  if (!(baseDir && existsSync(baseDir))) {
    baseDir = join(tmpDir, String(Date.now()), 'tmpapp');
    mkdirp.sync(baseDir);
    writeFileSync(join(baseDir, 'package.json'), JSON.stringify({ name: 'tmpapp' }));
  }

  const iedoLoader = findIedoCore({ baseDir, framework }).IedoLoader;
  const { Application } = require(framework);
  if (env) process.env.IEDO_SERVER_ENV = env;
  return new iedoLoader({
    baseDir,
    logger,
    app: Object.create(Application.prototype),
  });
}

function findIedoCore({ baseDir, framework }: FrameworkPathOptions) {
  try {
    const name = 'iedo-core';
    return require(name);
  } catch (error) {
    let iedoCorePath = join(baseDir, 'node_modules/@eadydo/core');
    if (!existsSync(iedoCorePath)) {
      iedoCorePath = join(framework, 'node_modules/@eadydo/core');
    }
    assert(existsSync(iedoCorePath), `Can't find eadydo core from ${baseDir} or ${framework}`);
    return require(iedoCorePath);
  }
}
