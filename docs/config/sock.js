const configureNamespace = () => {
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

window.configureNamespace = configureNamespace;
