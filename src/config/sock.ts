import { toNamespace } from "project-sock";

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

const configureNamespace = (env: string): Namespace => {
  const sep = "__";

  return toNamespace({
    opaque: {
      sep,
      project: {
        title: `${env}-verify`,
        prefix: "v"
      },
      operations: [{
        "v": [{
          ":pake_init": [ "register", "registered" ]
        }, {
          ":pake": [
            "authenticated", "client_authenticated",
            "server_auth_data", "client_auth_data", "client_auth_result"
          ]
        }]
      }]
    },
    mailbox: {
      sep,
      project: {
        title: `${env}-mailbox`,
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
