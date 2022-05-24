import { IedoCore } from '@iedo/core';

const app = new IedoCore({
  baseDir: '',
});

app.ready(() => {
  app.listen(3000);
});
