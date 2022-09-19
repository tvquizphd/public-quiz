const needKeys = (obj, keys) => {
  const obj_keys = Object.keys(obj).join(' ');
  for (key of keys) {
    if ('error' in obj) {
      throw new Error(obj.error);
    }
    if (!(key in obj)) {
      throw new Error(`${key} not in [${obj_keys}]`);
    }
  }
}

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

const findProject = async (inputs) => {
  const { octograph, owner, title } = inputs;
  const { nodes } = (await octograph(`
    query {
      user(login: "${owner}"){
        projectsV2(first: 1, query: "${title}") {
          nodes {
            number,
            id
          }
        }
      }
    }
  `)).user.projectsV2;
  return nodes.length ? nodes[0] : null;
}

const createProject = async (inputs) => {
  const { octograph, ownerId, title } = inputs;
  const input = `{ownerId: "${ownerId}", title: "${title}"}`;
  return (await octograph(`
    mutation {
      createProjectV2(input: ${input}) {
        projectV2 {
          number,
          id
        }
      }
    }
  `)).createProjectV2.projectV2;
}

const loadProject = async (inputs) => {
  const { title } = inputs;
  const node = await findProject(inputs);
  const need_keys = ["number", "id"];
  try {
    needKeys(node || {}, need_keys);
    console.log(`Found Project '${title}'`);
    return node;
  }
  catch {
    console.log(`Creating Project '${title}'`);
    return await createProject(inputs);
  }
}

const seeOwner = async (inputs) => {
  const { octograph, owner } = inputs;
  return (await octograph(`
    query {
      user(login: "${owner}") {
        id
      }
    }
  `)).user;
}

const toProject = (inputs) => {
  const {token, owner, title} = inputs;
  const octograph = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    }
  });
  const inputs_1 = { owner, octograph };
  const promise_1 = seeOwner(inputs_1);
  return promise_1.then((user) => {
    const ownerId = user.id;
    const inputs_2 = {
       owner, ownerId, octograph, title
    };
    const promise_2 = loadProject(inputs_2);
    return promise_2.then(({ id, number }) => {
      console.log(`Loaded Project '${title}'`);
      const inputs_3 = {
        ...inputs_2,
        number,
        id
      };
      return new Project(inputs_3);
    }).catch((error) => {
      console.error(`Unable to load project.`);
      console.error(error.message);
    })
  }).catch((error) => {
    console.error(`Unable to see owner "${owner}"`);
    console.error(error.message);
  });
}

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

window.toProjectSock = toProjectSock;
