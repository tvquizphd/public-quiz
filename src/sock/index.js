const { LocalChannel } = require("./localChannel");
const { ProjectChannel } = require("./projectChannel");
const { toProject } = require("./toProject");

const socket = (sock) => ({
  sock,
  get: (op_id, tag) => {
    return new Promise(function (resolve) {
      const k = sock.toKey(op_id, tag);
      if (!sock.hasResponse(k)) {
        sock.listenForKey(k, resolve);
      } else {
        sock.receiveMailKey(k, resolve);
      }
    });
  },
  give: (op_id, tag, msg) => {
    const k = sock.toKey(op_id, tag);
    if (!sock.hasRequest(k)) {
      sock.cacheMail(k, msg);
    } else {
      sock.sendMail(k, msg);
    }
  },
});

const toProjectSock = async (inputs) => {
  const project = await toProject(inputs);
  const inputs_1 = { ...inputs, project };
  return socket(new ProjectChannel(inputs_1));
}

const toLocalSock = () => {
  return socket(new LocalChannel('local'));
}

module.exports.toProjectSock = toProjectSock;
module.exports.toLocalSock = toLocalSock;
