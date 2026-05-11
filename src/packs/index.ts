import type { Vertical } from "@prisma/client";
import type { Pack } from "./types";
import { dealershipPack } from "./dealership";
import { serviceShopPack } from "./service-shop";
import { wellnessPack } from "./wellness";

const ALL: Record<Vertical, Pack> = {
  dealership: dealershipPack,
  service_shop: serviceShopPack,
  wellness: wellnessPack,
};

export function packFor(v: Vertical): Pack {
  return ALL[v];
}

export const allPacks = ALL;
