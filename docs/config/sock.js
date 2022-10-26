import { toNamespace } from "project-sock";

const configureNamespace = (env) => {
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

export { configureNamespace };
