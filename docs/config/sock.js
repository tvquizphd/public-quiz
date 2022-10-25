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
          ":pake_init": [
            "sid", "pw", "registered"
          ],
        }, {
          ":pake": [
            "alpha", "Xu", "Au", "client_authenticated",
            "beta", "Xs", "c", "As", "authenticated"
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
