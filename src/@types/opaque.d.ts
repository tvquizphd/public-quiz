declare module '@nthparty/opaque' {
  import type { Socket } from "../util/socket";
  import type { Op } from "../util/types";
  declare const OP: (Sock: Socket) => Promise<Op>;
  export default OP;
}
