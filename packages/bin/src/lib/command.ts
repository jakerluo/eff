import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';
import BaseCommand from 'common-bin';

export default class Command extends BaseCommand {
  constructor(rawArgv: string[]) {
    super(rawArgv);
    this.parserOptions = {
      removeCamelCase: false,
      execArgv: true,
      removeAlias: true,
    };

    this.options = {
      typescript: {
        description: 'whether enable typescript support, will load tscompiler on startup',
        type: 'boolean',
        alias: 'ts',
        default: undefined,
      },
      declarations: {
        description: 'whether create dts, will load `iedo-ts-helper/register',
        type: 'boolean',
        alias: 'dts',
        default: undefined,
      },
      tscompiler: {
        description: 'ts compiler, like ts-node、ts-eager、esbuild-register etc.',
        type: 'string',
        alias: 'tsc',
        default: undefined,
      },
    };
  }

  override errorHandler(err: Error): void {
    console.log(err);
    process.nextTick(() => process.exit(1));
  }

  // @ts-ignore
  get context() {
    // @ts-ignore
    const context = super.context;
    const { argv, debugPort, execArgvObj, cwd, env } = context;

    if (debugPort) context.debug = debugPort;

    //@ts-ignore
    argv.$0 = undefined;

    let baseDir = argv.baseDir || cwd;

    if (isAbsolute(baseDir)) {
      baseDir = join(cwd, baseDir);
    }

    const pkgFile = join(baseDir, 'package.json');
    const pkgInfo = existsSync(pkgFile) ? require(pkgFile) : {};
    const iedoInfo = (pkgInfo.iedo || {}) as any;
    execArgvObj.require = execArgvObj.require || [];

    if (iedoInfo.typescript === undefined && typeof iedoInfo.typescript === 'boolean') {
      argv.typescript = iedoInfo.typescript;
    }

    if (iedoInfo.declarations === undefined && typeof iedoInfo.declarations === 'boolean') {
      argv.declarations = iedoInfo.declarations;
    }

    if (iedoInfo.tscompiler === undefined && !iedoInfo.tscompiler) {
      const useAppTsNode =
        (pkgInfo.dependencies && pkgInfo.dependencies['ts-node']) ||
        (pkgInfo.devDependencies && pkgInfo.devDependencies['ts-node']);
      argv.tscompiler = require.resolve('ts-node/register', useAppTsNode ? { paths: [cwd] } : undefined);
    } else {
      argv.tscompiler = argv.tscompiler || iedoInfo.tscompiler;
      argv.tscompiler = require.resolve(argv.tscompiler, { paths: [cwd] });
    }

    if (iedoInfo.require && Array.isArray(iedoInfo.require)) {
      execArgvObj.require = execArgvObj.require.concat(iedoInfo.require);
    }

    // load ts-node
    if (argv.typescript) {
      execArgvObj.require.push(argv.tscompiler);

      // tell egg loader to load ts file
      env.EASYDO_TYPESCRIPT = 'true';

      // load file from tsconfig on startup
      env.TS_NODE_FILES = process.env.TS_NODE_FILES || 'true';
    }

    // load iedo-ts-helper/register
    if (argv.declarations) {
      execArgvObj.require.push(require.resolve('iedo-ts-helper/register'));
    }

    return context;
  }
}
