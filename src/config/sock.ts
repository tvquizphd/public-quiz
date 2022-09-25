const { toNamespace } = require("project-sock");

export type Project = {
  title: string,
  prefix: string
}
export type Socket = {
  text: string,
  prefix: string,
  suffix: string
}
export type Command = Socket & {
  subcommand: string,
  command: string
}
export interface NameInterface {
  commands: Command[];
  sockets: Socket[];
  project: Project;
}
type Obj<T> = Record<string, T>
export type Namespace = Obj<NameInterface>

const configureNamespace = (): Namespace => {
  const sep = ["__", "", "__"];

  return toNamespace({
    opaque: {
      sep,
      project: {
        title: "verify",
        prefix: "v"
      },
      operations: [{
        "v": [{
          ":pake_init": [
            "sid", "pw", "registered"
          ],
        }, {
          ":pake": [
            "alpha", "Xu", "Au", "client_authenticated",
            "beta", "Xs", "c", "As", "authenticated"
          ]
        }]
        },{
        "stat": [{
          ":next": ["reset", "start"]
        }]
      }]
    },
    mailbox: {
      sep,
      project: {
        title: "mailbox",
        prefix: "m"
      },
      operations: [{
        "pass": [{
          ":load": [ "from_secret" ]
        }, {
          ":save": [ "to_secret" ]
        }]
      }]
    }
  })
}

export {
  configureNamespace
}
