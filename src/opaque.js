const IO = require('./io');
const OP = require('@nthparty/opaque')(IO);

const O = '_'; // Identifier
const T = 1000; // Iterations

const toPepper = async (inputs) => {
  const Opaque = await OP;
  const { clientRegister } = Opaque;
  const { user, password } = inputs;
  clientRegister(password, user, O);
  const { serverRegister } = Opaque;
  return await serverRegister(T, O);
}

exports.toPepper = toPepper;
