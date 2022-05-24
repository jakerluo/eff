'use strict';

export interface IedoApplication {}

export interface IedoApplicationConfig {}

export interface IedoApplicationService {}

export interface IedoContext {
  app: IedoApplication;
}

export default class BaseContextClass {
  ctx: IedoContext;
  app: IedoApplication;
  config: IedoApplicationConfig;
  service: IedoApplicationService;

  constructor(ctx: any) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.config = ctx.app.config;
    this.service = ctx.service;
  }
}
