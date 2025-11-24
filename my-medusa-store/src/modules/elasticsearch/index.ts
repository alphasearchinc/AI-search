import { Module } from "@medusajs/framework/utils";
import ElasticsearchModuleService from "./services/main";

export const ELASTICSEARCH_MODULE = "elasticsearch";

export default Module(ELASTICSEARCH_MODULE, {
  service: ElasticsearchModuleService,
});

export * from "./types";
