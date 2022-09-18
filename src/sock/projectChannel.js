const { toB64urlQuery, fromB64urlQuery } = require("../b64url")

const serialize = (data) => {
  return toB64urlQuery({ data });
}

const deserialize = (str) => {
  return fromB64urlQuery(str).data;
}

class ProjectChannel {
  constructor(inputs) {
    const { project, scope } = inputs;
    this.project = project;
    this.scope = scope;
  }
  hasResponse(k) {
    return this.project.hasResponse(k)
  }
  hasRequest(k) {
		return true;
  }
  toKey(op_id, tag) {
    const names = [this.scope, op_id, tag];
    return names.join('__');
  }
  listenForKey(k, res) {
		const resolve = (s) => res(deserialize(s));
    this.project.awaitItem([k, resolve]);
  }
  receiveMailKey(k, res) {
		const resolve = (s) => res(deserialize(s));
    this.project.resolver([k, resolve]);
  }
  cacheMail(k, a) {
		this.sendMail(k, a);
  }
  sendMail(k, a) {
		this.project.addItem(k, serialize(a));
  }
}

exports.ProjectChannel = ProjectChannel;
