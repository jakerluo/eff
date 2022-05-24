export type Level = 'ALL' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';
export type LevelValue = number;

const levels: Record<Level, number> = {
  ALL: -Infinity,
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: Infinity,
};

export default levels;
