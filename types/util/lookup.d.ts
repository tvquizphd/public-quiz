import type { NameInterface as I } from "../config/sock";
import type { Command } from "../config/sock";
declare function findSub(inputs: I, sub: string): Command;
declare function findOp(inputs: I, sub: string): string;
declare function opId(inputs: I, sub: string): string;
export { opId, findOp, findSub };
