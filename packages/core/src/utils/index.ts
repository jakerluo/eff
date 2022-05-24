import { readFileSync } from 'fs';
import BuiltinModules from 'module';
import is from 'is-type-of';
import { extname as extname$0 } from 'path';
import * as co from 'co';

const Module = module.constructor.length > 1 ? module.constructor : BuiltinModules;

// @ts-ignore
export const extensions = Module._extensions;

export function loadFile(filepath: string) {
  try {
    const extname = extname$0(filepath);
    // @ts-ignore
    if (extname && !Module._extensions[extname]) {
      return readFileSync(filepath);
    }

    const obj = require(filepath);
    if (obj._esModule) return 'default' in obj ? obj.default : obj;
  } catch (error) {}
}

function prepareObjectStackTrace(obj: Error, stack: NodeJS.CallSite[]) {
  return stack;
}

export function getCalleeFromStack(withLine?: unknown[], stackIndex?: number) {
  stackIndex = stackIndex === undefined ? 2 : stackIndex;
  const limit = Error.stackTraceLimit;
  const prep = Error.prepareStackTrace;

  Error.prepareStackTrace = prepareObjectStackTrace;

  Error.stackTraceLimit = 5;

  const obj: {
    stack?: NodeJS.CallSite[];
  } = {};
  Error.captureStackTrace(obj);
  let callSite = obj.stack?.[stackIndex];

  let fileName;

  if (callSite) {
    fileName = callSite.getFileName();

    if (fileName && fileName.endsWith('iedo-mock/lib/app.js')) {
      callSite = obj.stack?.[stackIndex + 1];
      fileName = callSite?.getFileName();
    }
  }

  Error.prepareStackTrace = prep;
  Error.stackTraceLimit = limit;

  if (!callSite || !fileName) return '<anonymous>';
  if (!withLine) return fileName;
  return `${fileName}:${callSite.getLineNumber()}:${callSite.getColumnNumber()}`;
}

export async function callFn(fn, args, ctx) {
  args = args || [];
  if (!is.function(fn)) return;
  if (is.generatorFunction(fn)) co.wrap(fn);
  return ctx ? fn.apply(ctx, ...args) : fn(...args);
}
