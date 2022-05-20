import { join } from 'path';
import * as rimraf from 'rimraf';
import { rollup, watch as rollupWatch, OutputOptions, RollupOptions, RollupWatchOptions, ChangeEvent } from 'rollup';

interface TaskOptions {
  packageName: string;
}

let isWatch = false;
const args = process.argv.slice(2);

if (args.includes('--watch')) {
  isWatch = true;
}

const config: TaskOptions[] = [
  {
    packageName: 'utils',
  },
  {
    packageName: 'bin',
  },
  {
    packageName: 'iedo',
  },
];

runTasks(config);

async function runTasks(configs: TaskOptions[]) {
  try {
    await configs.reduce((prev, curr) => prev.then(() => task(curr)), Promise.resolve());
  } catch (error) {
    console.log('error: ', error);
  }
}

async function task(taskOptions: TaskOptions) {
  const { packageName } = taskOptions;

  const root = process.cwd();

  // pacakges/bin/src/index.ts
  const getPackageDir = () => join(root, 'packages', packageName, 'src');

  const getPackageDist = () => join(root, 'packages', packageName, 'dist');

  const getPackageInfo = () => require(join(root, 'packages', packageName, 'package.json'));

  const inputOptions: RollupOptions = {
    input: join(getPackageDir(), 'index.ts'),
    external: [...Object.keys(getPackageInfo().dependencies || {}), 'fs', 'path', 'os', 'assert'],
    plugins: [
      require('@rollup/plugin-typescript')({
        tsconfig: join(process.cwd(), 'tsconfig.json'),
        filterRoot: getPackageDir(),
        compilerOptions: { declaration: true, outDir: getPackageDist() },
      }),
    ],
  };

  const outputOptions: OutputOptions = {
    format: 'cjs',
    exports: 'named',
    dir: getPackageDist(),
    preserveModules: true,
    preserveModulesRoot: getPackageDir(),
  };

  const watchOptions: RollupWatchOptions = {
    input: inputOptions.input,
    output: outputOptions,
    plugins: inputOptions.plugins,
    external: inputOptions.external,
    watch: {
      chokidar: {
        usePolling: true,
      },
    },
  };

  await removeDist(getPackageDist());

  if (isWatch) {
    await watch();
  } else {
    await build();
  }

  async function build() {
    let bundle;
    let buildFailed = false;

    try {
      bundle = await rollup(inputOptions);
    } catch (error) {
      buildFailed = true;
      console.error(error);
    }

    if (bundle) {
      await bundle.write(outputOptions);
      await bundle.close();
    }

    console.log(`${buildFailed ? `${packageName}  Build failed` : `${packageName} Build success`}`);
  }

  function watch() {
    return new Promise<void>((resolve, reject) => {
      const watcher = rollupWatch(watchOptions);

      watcher.on('change', (id, change: { event: ChangeEvent }) => {
        console.log(`${id} ${change.event}`);
      });

      watcher.on('event', (event) => {
        if (event.code === 'ERROR') {
          console.log(packageName, event.error);
          reject();
        }
      });

      watcher.on('event', (event) => {
        if (event.code === 'END') {
          console.log(`watch ${packageName} success`);
          resolve();
        }
      });
    });
  }
}

function removeDist(dir: string) {
  return new Promise<void>((resolve, reject) => {
    rimraf(dir, (err) => {
      if (err) {
        console.log(`rimraf ${dir} err: `, err);
        reject(err);
        process.exit(1);
      }
      resolve();
    });
  });
}
