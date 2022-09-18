const { toLocalSock } = require('./sock');
const OP = require('@nthparty/opaque');

const O = '_'; // Identifier
const T = 1000; // Iterations

const toPepper = async (inputs) => {
  const localSocket = toLocalSock();
  const Opaque = await OP(localSocket);
  const { clientRegister } = Opaque;
  const { user, password } = inputs;
  clientRegister(password, user, O);
  const { serverRegister } = Opaque;
  return await serverRegister(T, O);
}

exports.toPepper = toPepper;
