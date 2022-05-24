'use strict';

import debug$0 from 'debug';

const debug = debug$0('iedo-core#sequencify');

interface Task {
  dependencies: string[];
  optionalDependencies: string[];
}

interface Results {
  requires: Record<string, unknown>;
  sequence: string[];
}

export type SequenceFn = (
  tasks: Record<string, Task>,
  names: string[],
  results: Results,
  missing: string[],
  recursive: any[],
  nest: any[],
  optional: boolean,
  parent: string
) => void;

const sequence: SequenceFn = (tasks, names, results, missing, recursive, nest, optional, parent) => {
  names.forEach(function (name) {
    if (results.requires[name]) return;

    const node = tasks[name];
    if (!node) {
      if (optional === true) return;
      missing.push(name);
    } else if (nest.includes(name)) {
      nest.push(name);
      recursive.push(nest.slice(0));
      // @ts-ignore
      nest.pop(name);
    } else if (node.dependencies.length || node.optionalDependencies.length) {
      nest.push(name);
      if (node.dependencies.length) {
        sequence(tasks, node.dependencies, results, missing, recursive, nest, optional, name);
      }
      if (node.optionalDependencies.length) {
        sequence(tasks, node.optionalDependencies, results, missing, recursive, nest, true, name);
      }

      // @ts-ignore
      nest.pop(name);
    }
    if (!optional) {
      results.requires[name] = true;
      debug('task: %s is enabled by %s', name, parent);
    }

    if (!results.sequence.includes(name)) {
      results.sequence.push(name);
    }
  });
};

export default function (tasks: Record<string, Task>, names: string[]) {
  const results: Results = {
    requires: {},
    sequence: [],
  };

  const missing: Parameters<SequenceFn>[4] = [];
  const recursive: Parameters<SequenceFn>[5] = [];
  sequence(tasks, names, results, missing, recursive, [], false, 'app');

  if (missing.length || recursive.length) {
    results.sequence = [];
  }

  return {
    sequence: results.sequence.filter((item) => results.requires[item]),
    missingTasks: missing,
    recursiveDependencies: recursive,
  };
}
