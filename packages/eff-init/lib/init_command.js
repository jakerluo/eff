'use strict';

const urllib = require('urllib');
const inquirer = require('inquirer');
const yargs = require('yargs');
const ProxyAgent = require('proxy-agent');
const chalk = require('chalk');
const os = require('os');
const fs = require('fs');
const path = require('path');
const homedir = require('node-homedir');
const updater = require('npm-updater');
const mkdirp = require('mkdirp');
const assert = require('assert');
const rimraf = require('mz-modules/rimraf');
const is = require('is-type-of');
const compressing = require('compressing');
const glob = require('globby');
const isTextOrBinary = require('istextorbinary');

module.exports = class Command {
  constructor(options) {
    options = options || {};
    this.name = options.name || 'eff-init';
    this.configName = options.configName || 'eff-init-config';
    this.pkgInfo = options.pkgInfo || require('../package.json');
    this.needUpdate = options.needUpdate !== false;
    this.httpClient = urllib.create();
    this.inquirer = inquirer;

    this.fileMapping = {
      gitignore: '.gitignore',
      _gitignore: '.gitignore',
      '_.gitignore': '.gitignore',
      '_package.json': 'package.json',
      '_.eslintrc': '.eslintrc',
      '_.eslintignore': '.eslintignore',
      '_.npmignore': '.npmignore',
    };
  }

  async run(cwd, args) {
    const argv = (this.argv = this.getParser().parse(args || []));
    this.cwd = cwd;

    const proxyHost = process.env.http_proxy || process.env.HTTP_PROXY;
    if (proxyHost) {
      const proxyAgent = new ProxyAgent(proxyHost);
      this.httpClient.agent = proxyAgent;
      this.httpClient.httpsAgent = proxyAgent;
      this.log(`use http proxy: ${proxyHost}`);
    }

    this.registryUrl = this.getRegistryByType(argv.registry);
    this.log(`use registry: ${this.registryUrl}`);

    if (this.needUpdate) {
      await updater({
        package: this.pkgInfo,
        registry: this.registryUrl,
        level: 'major',
      });
    }

    this.targetDir = await this.getTargetDirectory();

    let templateDir = await this.getTemplateDir();

    if (!templateDir) {
      let pkgName = this.argv.package;
      if (!pkgName) {
        const boilerplateMapping = await this.fetchBoilerplateMapping(pkgName);
        let boilerplate;
        if (argv.type && boilerplateMapping.hasOwnProperty(argv.type)) {
          boilerplate = boilerplateMapping[argv.type];
        } else {
          boilerplate = await this.askForBoilerplateType(boilerplateMapping);
          if (!boilerplate) return;
        }
        this.log(
          `use boilerplate: ${boilerplate.name}(${boilerplate.package})`
        );
        pkgName = boilerplate.package;
      }
      templateDir = await this.downloadBoilerplate(pkgName);
    }

    await this.processFiles(this.targetDir, templateDir);

    this.printUsage;
  }

  async processFiles(targetDir, templateDir) {
    const src = path.join(templateDir, 'boilerplate');
    console.log('src: ', src);
    const locals = await this.askForVariable(targetDir, templateDir);
    const files = glob.sync('**/*', {
      cwd: src,
      dot: true,
      onlyFiles: false,
      followSymlinkedDirectories: false,
    });
    files.forEach(file => {
      const { dir: dirname, base: basename } = path.parse(file);
      const from = path.join(src, file);
      const fileName = this.fileMapping[basename] || basename;
      const to = path.join(
        targetDir,
        dirname,
        this.replaceTemplate(fileName, locals)
      );
      const stats = fs.lstatSync(from);
      if (stats.isSymbolicLink()) {
        const target = fs.readFileSync(from);
        fs.symlinkSync(target, to);
        this.log('%s link to %s', to, target);
      } else if (stats.isDirectory()) {
        mkdirp.sync(to);
      } else if (stats.isFile()) {
        const content = fs.readFileSync(from);
        this.log('write to %s', to);

        const result = isTextOrBinary.isText(from, content)
          ? this.replaceTemplate(content.toString('utf8'), locals)
          : content;
        fs.writeFileSync(to, result);
      } else {
        this.log('ignore %s only support file, dir, symlink', file);
      }
    });
    return files;
  }

  replaceTemplate(content, scope) {
    return content
      .toString()
      .replace(/(\\)?{{ *(\w+) *}}/g, (block, skip, key) => {
        if (skip) {
          return block.subString(skip.length);
        }
        return scope.hasOwnProperty(key) ? scope[key] : block;
      });
  }

  async askForVariable(targetDir, templateDir) {
    let questions;

    try {
      questions = require(templateDir);
      console.log('questions: ', questions);
      if (is.function(questions)) {
        questions = questions(targetDir);
      }
      if (questions.name && !questions.name.default) {
        questions.name.default = path.basename(targetDir).replace(/^eff-/, '');
      }
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        this.log(
          chalk.yellow(
            `load boilerplate config got trouble, skip and use defaults, ${error.message}`
          )
        );
      }
      return {};
    }

    this.log('collecting boilerplate config...');
    const keys = Object.keys(questions);
    if (this.argv.silent) {
      const result = keys.reduce((result, key) => {
        const defaultFn = questions[key].default;
        const filterFn = questions[key].filter;
        if (defaultFn === 'function') {
          result[key] = defaultFn() || '';
        } else {
          result[key] = questions[key].default || '';
        }
        if (typeof filterFn === 'function') {
          result[key] = filterFn(result[key]) || '';
        }
        return result;
      });

      this.log('use default config due to --silent, %j: ', result);
      return result;
    }
    return inquirer.prompt(
      keys.map(key => {
        const question = questions[key];
        return {
          type: question.type || 'input',
          name: key,
          message: question.description || question.desc,
          default: question.default,
          filter: question.filter,
          choices: question.choices,
        };
      })
    );
  }

  async downloadBoilerplate(pkgName) {
    const result = await this.getPackageInfo(pkgName, false);
    const tgzUrl = result.dist.tarball;

    this.log(`downloading ${tgzUrl}`);

    const saveDir = path.join(os.tmpdir(), 'egg-init-boilerplate');
    await rimraf(saveDir);
    const response = await this.curl(tgzUrl, {
      streaming: true,
      followRedirect: true,
    });

    await compressing.tgz.uncompress(response.res, saveDir);

    this.log(`download success, unzip to ${saveDir}`);

    return path.join(saveDir, '/package');
  }

  async askForBoilerplateType(mapping) {
    const groupMapping = this.groupBy(mapping, 'category', 'other');
    const groupNames = Object.keys(groupMapping);
    let group;

    if (groupNames.length > 1) {
      const answer = await this.inquirer.prompt({
        name: 'group',
        type: 'list',
        message: 'please select boilerplate group',
        choices: groupNames,
        pageSize: groupNames.length,
      });
      console.log('answer: ', answer);
      group = groupMapping[answer.group];
    } else {
      group = groupMapping[groupNames[0]];
    }

    const choices = Object.keys(group).map(key => {
      const item = group[key];
      return {
        name: `${key} (${item.description})`,
        value: item,
      };
    });

    choices.unshift(new inquirer.Separator());

    const { boilerplateInfo } = await this.inquirer.prompt({
      name: 'boilerplateInfo',
      type: 'list',
      choices,
      message: 'please select a boilerplate type',
    });

    if (!boilerplateInfo.deprecate) {
      return boilerplateInfo;
    }

    const { shouldInstall } = await this.inquirer.prompt({
      name: 'shouldInstall',
      type: 'list',
      choices: [
        {
          name: `1, ${boilerplateInfo.deprecate}`,
          value: false,
        },
        {
          name: '2, I still want to continue installing',
          value: true,
        },
      ],
    });

    if (shouldInstall) {
      return boilerplateInfo;
    }
    console.log(`Exit due to: ${boilerplateInfo.deprecate}`);
    return;
  }

  groupBy(obj, key, otherKey) {
    const result = {};
    for (const i in obj) {
      let isMatch = false;
      for (const j in obj[i]) {
        // check if obj[i]'s property is 'key'
        if (j === key) {
          const mappingItem = obj[i][j];
          if (typeof result[mappingItem] === 'undefined') {
            result[mappingItem] = {};
          }
          result[mappingItem][i] = obj[i];
          isMatch = true;
          break;
        }
      }
      if (!isMatch) {
        // obj[i] doesn't have property 'key', then use 'otherKey' to group
        if (typeof result[otherKey] === 'undefined') {
          result[otherKey] = {};
        }
        result[otherKey][i] = obj[i];
      }
    }
    return result;
  }

  async fetchBoilerplateMapping(pkgName) {
    const pkgInfo = await this.getPackageInfo(pkgName || this.configName, true);
    const mapping = pkgInfo.config.boilerplate;
    Object.keys(mapping).forEach(key => {
      const item = mapping[key];
      item.name = item.name || key;
      item.from = pkgInfo;
    });
    return mapping;
  }

  async curl(url, options) {
    return this.httpClient.request(url, options);
  }

  async getPackageInfo(pkgName, withFallback) {
    this.log(`fetch ${pkgName} info from registry`);

    try {
      const result = await this.curl(`${this.registryUrl}/${pkgName}/latest`, {
        dataType: 'json',
        followRedirect: true,
        maxRedirects: 5,
        timeout: 5000,
      });
      assert(
        result.status === 200,
        `fetch ${pkgName} info error: ${result.status}, ${result.data.reason}`
      );
      return result.data;
    } catch (err) {
      if (withFallback) {
        this.log(`use fallback from ${pkgName}`);
        return require(`${pkgName}/package.json`);
      }
      throw err;
    }
  }

  async getTemplateDir() {
    let templateDir;
    // when use `egg-init --template=PATH`
    if (this.argv.template) {
      templateDir = path.resolve(this.cwd, this.argv.template);
      if (!fs.existsSync(templateDir)) {
        this.log(chalk.red(`${templateDir} is not exists`));
      } else if (!fs.existsSync(path.join(templateDir, 'boilerplate'))) {
        this.log(chalk.red(`${templateDir} should contain boilerplate folder`));
      } else {
        this.log(`local template dir is ${chalk.green(templateDir)}`);
        return templateDir;
      }
    }
  }

  async getTargetDirectory() {
    const dir = this.argv._[0] || this.argv.dir || '';
    let targetDir = path.resolve(this.cwd, dir);
    const force = this.argv.force;

    const validate = dir => {
      // create dir if not exist
      if (!fs.existsSync(dir)) {
        mkdirp.sync(dir);
        return true;
      }

      // not a directory
      if (!fs.statSync(dir).isDirectory()) {
        return chalk.red(`${dir} already exists as a file`);
      }

      // check if directory empty
      const files = fs.readdirSync(dir).filter(name => name[0] !== '.');
      if (files.length > 0) {
        if (force) {
          this.log(
            chalk.red(
              `${dir} already exists and will be override due to --force`
            )
          );
          return true;
        }
        return chalk.red(
          `${dir} already exists and not empty: ${JSON.stringify(files)}`
        );
      }
      return true;
    };

    const isValid = validate(targetDir);
    if (isValid !== true) {
      this.log(isValid);
      const answer = await this.inquirer.prompt({
        name: 'dir',
        message: 'Please enter target dir: ',
        default: dir || '.',
        filter: dir => path.resolve(this.cwd, dir),
        validate,
      });
      targetDir = answer.dir;
    }
    this.log(`target dir is ${targetDir}`);
    return targetDir;
  }

  printUsage() {
    this.log(`usage:
      - cd ${this.targetDir}
      - npm install
      - npm start / npm run dev / npm test
    `);
  }

  getRegistryByType(key) {
    switch (key) {
      case 'china':
        return 'https://registry.npmmirror.com';
      case 'npm':
        return 'https://registry.npmjs.org';
      default: {
        if (/^https?:/.test(key)) {
          return key.replace(/\/$/, '');
        }
        // support .npmrc
        const home = homedir();
        let url =
          process.env.npm_registry ||
          process.env.npm_config_registry ||
          'https://registry.npmjs.org';
        if (
          fs.existsSync(path.join(home, '.cnpmrc')) ||
          fs.existsSync(path.join(home, '.tnpmrc'))
        ) {
          url = 'https://registry.npmmirror.com';
        }
        url = url.replace(/\/$/, '');
        return url;
      }
    }
  }

  getParser() {
    return yargs
      .usage(
        'init eff project from boilerplate. \n Usage: $0 [dir] --type=simple'
      )
      .options(this.getParserOptions())
      .alias('h', 'help')
      .version()
      .help();
  }

  getParserOptions() {
    return {
      type: {
        type: 'string',
        description: 'boilerplate type',
      },
      dir: {
        type: 'string',
        description: 'target directory',
      },
      force: {
        type: 'boolean',
        description: 'force to override directory',
        alias: 'f',
      },
      template: {
        type: 'string',
        description: 'local path to boilerplate',
      },
      package: {
        type: 'string',
        description: 'boilerplate package name',
      },
      registry: {
        type: 'string',
        description:
          'npm registry, support china/npm/custom, default to auto detect',
        alias: 'r',
      },
      silent: {
        type: 'boolean',
        description: "don't ask, just use default value",
      },
    };
  }

  log() {
    const args = Array.prototype.slice.call(arguments);
    args[0] = chalk.blue(`[${this.name}]`) + ' ' + args[0];
    console.log.apply(console, args);
  }
};
