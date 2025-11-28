const sessions = new Map();

export function createSession(walletPubkey, res) {
  const sid = Math.random().toString(36).slice(2);
  sessions.set(sid, {
    walletPubkey,
    secretKey: null,
  });

  res.cookie("sid", sid, {
    httpOnly: true,
    sameSite: "lax"
  });

  return sid;
}

export function getSession(req) {
  const sid = req.cookies?.sid;
  return sid && sessions.has(sid) ? sessions.get(sid) : null;
}
