class LocalChannel {
  constructor(scope) {
    this.scope = scope;
    this.requests = {};
    this.responses = {};
  }
  
  hasResponse(k) {
    return k in this.responses;
  }
  hasRequest(k) {
    return k in this.requests;
  }

  toKey(op_id, tag) {
    const names = [this.scope, op_id, tag];
    return names.join(':');
  }
  listenForKey(k, resolve) {
    // Awaiting ability to get k
    this.requests[k] = resolve;
  }
  receiveMailKey(k, resolve) {
    // Now able to get k
    resolve(this.responses[k]);
    delete this.responses[k];
  }
  cacheMail(k, msg) {
    this.responses[k] = msg;
  }
  sendMail(k, msg) {
    this.requests[k](msg);
    delete this.requests[k];
  }
}

exports.LocalChannel = LocalChannel;
