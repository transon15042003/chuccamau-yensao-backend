import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import MomoProviderService from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [MomoProviderService],
});
