const UTIL = (sodium, oprf) => {
  const sodiumAeadEncrypt = (key, plaintext) => {
    let raw_ciphertext = sodium.crypto_aead_chacha20poly1305_encrypt(plaintext, null, null, new Uint8Array(8), key);
    let mac_tag = sodium.crypto_auth_hmacsha512(raw_ciphertext, key);
    return { mac_tag, body: raw_ciphertext };
  };

  const sodiumAeadDecrypt = (key, ciphertext) => {
    if (sodium.crypto_auth_hmacsha512_verify(ciphertext.mac_tag, ciphertext.body, key) === true) {
      try {
        return sodium.crypto_aead_chacha20poly1305_decrypt(null, ciphertext.body, null, new Uint8Array(8), key);
      } catch (_) {
        return sodiumFromByte(255);
      }
    } else {
      throw new Error("Invalid Message Authentication Code.  Someone may have tampered with the ciphertext.");
    }
  };

  const oprfKdf = pwd => oprf.hashToPoint(pwd);
  const oprfH = (x, m) => oprf.unmaskPoint(x, m);
  const oprfH1 = x => oprf.maskPoint(x);
  const oprfRaise = (x, y) => oprf.scalarMult(x, y);
  const genericHash = x => sodium.crypto_core_ristretto255_from_hash(x);
  const iteratedHash = (x, t = 1000) => {
    return sodium.crypto_generichash(x.length, t === 1 ? x : iteratedHash(x, t-1));
  };

  const oprfF = (k, x) => {
    if (sodium.crypto_core_ristretto255_is_valid_point(x) === false || sodium.is_zero(x)) {
      x = oprf.hashToPoint(x);
    }

    const _H1_x_ = oprfH1(x);
    const H1_x = _H1_x_.point;
    const mask = _H1_x_.mask;

    const H1_x_k = oprfRaise(H1_x, k);

    const unmasked = oprfH(H1_x_k, mask);

    return unmasked;
  };

  const sodiumFromByte = (n) => {
    return new Uint8Array(32).fill(n);
  };

  const KE = (p, x, P, X, X1) => {
    const kx = oprf.scalarMult(X, x);
    const kp = oprf.scalarMult(P, p);
    const k = genericHash(sodium.crypto_core_ristretto255_add(kx, kp));
    return k;
  };

  return {
    oprfF,
    oprfKdf,
    oprfH,
    oprfH1,
    oprfRaise,
    KE,
    iteratedHash,
    sodiumFromByte,
    sodiumAeadEncrypt,
    sodiumAeadDecrypt
  };
};

const OPAQUE = (io, sodium, oprf) => {
  const util = UTIL(sodium, oprf);

  // Sign up as a new user
  const clientRegister = async (password, user_id, op_id) => {
    op_id = op_id + ':pake_init';
    const get = io.get.bind(null, op_id);
    const give = io.give.bind(null, op_id);

    const pw = util.oprfKdf(password);
    give('sid', user_id);
    give('pw', pw);

    return await get('registered');
  };

  // Register a new user for the first time
  const serverRegister = async (t, op_id) => {
    op_id = op_id + ':pake_init';
    const get = io.get.bind(null, op_id);
    const give = io.give.bind(null, op_id);

    const sid = await get('sid');
    const pw = await get('pw');

    const ks = sodium.crypto_core_ristretto255_scalar_random();
    const rw = util.iteratedHash(util.oprfF(ks, pw), t);
    const ps = sodium.crypto_core_ristretto255_scalar_random();
    const pu = sodium.crypto_core_ristretto255_scalar_random();
    const Ps = sodium.crypto_scalarmult_ristretto255_base(ps);
    const Pu = sodium.crypto_scalarmult_ristretto255_base(pu);
    const c = {
      pu: util.sodiumAeadEncrypt(rw, pu),
      Pu: util.sodiumAeadEncrypt(rw, Pu),
      Ps: util.sodiumAeadEncrypt(rw, Ps)
    };

    const user_record = {id: sid, pepper: {ks: ks, ps: ps, Ps: Ps, Pu: Pu, c: c}};
    give('registered', true);

    return user_record;
  };

  // Try to log in
  const clientAuthenticate = async (password, user_id, t, op_id) => {
    op_id = op_id + ':pake';
    const get = io.get.bind(null, op_id);
    const give = io.give.bind(null, op_id);

    const r = sodium.crypto_core_ristretto255_scalar_random();
    const xu = sodium.crypto_core_ristretto255_scalar_random();

    const pw = util.oprfKdf(password);
    const _H1_x_ = util.oprfH1(pw);
    const H1_x = _H1_x_.point;
    const mask = _H1_x_.mask;
    const a = util.oprfRaise(H1_x, r);

    const Xu = sodium.crypto_scalarmult_ristretto255_base(xu);
    give('alpha', a);
    give('Xu', Xu);

    const b = await get('beta');

    if (!sodium.crypto_core_ristretto255_is_valid_point(b)) {
      console.log('client_authenticated_1 false ' + user_id);
      give('client_authenticated', false);
      throw new Error('client_authenticated_1 false');
    }

    const c = await get('c');
    const r_inv = sodium.crypto_core_ristretto255_scalar_invert(r);
    const rw = util.iteratedHash(util.oprfH(util.oprfRaise(b, r_inv), mask), t);
    const pu = util.sodiumAeadDecrypt(rw, c.pu);

    if (!sodium.crypto_core_ristretto255_is_valid_point(pu)) {
      console.log('client_authenticated_2 false ' + user_id);
      give('client_authenticated', false);
      throw new Error('client_authenticated_2 false');
    }

    const Pu = util.sodiumAeadDecrypt(rw, c.Pu);
    const Ps = util.sodiumAeadDecrypt(rw, c.Ps);
    const Xs = await get('Xs');
    const K = util.KE(pu, xu, Ps, Xs, Xu);
    const SK = util.oprfF(K, util.sodiumFromByte(0));
    const As = util.oprfF(K, util.sodiumFromByte(1));
    const Au = util.oprfF(K, util.sodiumFromByte(2));

    const __As = await get('As');

    if (sodium.compare(As, __As) !== 0) { // The comparable value of 0 means As equals __As
      console.log('client_authenticated_3 false ' + user_id);
      give('client_authenticated', false);
      throw new Error('client_authenticated_3 false');
    }

    give('Au', Au);

    const success = await get('authenticated');
    if (success) {
      const token = sodium.to_hex(SK);
      return token;
    } else {
      console.log('client_authenticated_4 false ' + user_id);
      give('client_authenticated', false);
      throw new Error('client_authenticated_4 false');
    }
  };

  // Authenticate a user
  const serverAuthenticate = async (user_id, pepper, op_id) => {
    op_id = op_id + ':pake';
    const get = io.get.bind(null, op_id);
    const give = io.give.bind(null, op_id);

    const a = await get('alpha');
    if (!sodium.crypto_core_ristretto255_is_valid_point(a)) {
      console.log('Authentication failed.  Alpha is not a group element.');
      give('authenticated', false);
      throw new Error('Authentication failed.  Alpha is not a group element.');
    }
    const xs = sodium.crypto_core_ristretto255_scalar_random();
    const b = util.oprfRaise(a, pepper.ks);
    const Xs = sodium.crypto_scalarmult_ristretto255_base(xs);

    const Xu = await get('Xu');
    const K = util.KE(pepper.ps, xs, pepper.Pu, Xu, Xs);
    const SK = util.oprfF(K, util.sodiumFromByte(0));
    const As = util.oprfF(K, util.sodiumFromByte(1));
    const Au = util.oprfF(K, util.sodiumFromByte(2));

    give('beta', b);
    give('Xs', Xs);
    give('c', pepper.c);
    give('As', As);

    const __Au = await get('Au');
    if (sodium.compare(Au, __Au) === 0) {  // The comparable value of 0 means equality
      give('authenticated', true);
      const token = sodium.to_hex(SK);
      return token;
    } else {
      console.log('Authentication failed.  Wrong password for ' + user_id);
      give('authenticated', false);
      throw new Error('Authentication failed.  Wrong password for ' + user_id);
    }
  };

  return {
    clientRegister,
    serverRegister,
    clientAuthenticate,
    serverAuthenticate
  };
};

window.OP = (io) => {
  const { OPRF } = window;
  const oprf = new OPRF();
  const { sodium } = oprf;
  const opaque = OPAQUE(io, sodium, oprf);

  return new Promise(async (resolve) => {
    await oprf.ready;
    resolve(opaque);
  });
};
