export type LevelValue = number;

const levels = {
  ALL: -Infinity,
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: Infinity,
};

export type Level = keyof typeof levels;

export default levels;
