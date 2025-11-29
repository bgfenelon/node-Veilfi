// server/sessions.js
const sessions = new Map();

function createSession(walletPubkey, secretKey, res, isProduction = false) {
  const sid = Math.random().toString(36).slice(2);
  sessions.set(sid, { walletPubkey, secretKey });

  const cookieOpts = {
    httpOnly: true,
    secure: true,        // 🔥 OBRIGATÓRIO para SameSite=None
    sameSite: "none",    // 🔥 Render bloqueia sem isso
    path: "/",           // 🔥 Permite usar em /wallet e /session
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 dias
  };

  res.cookie("sid", sid, cookieOpts);
  return sid;
}

function getSession(req) {
  const sid = req.cookies?.sid;
  if (!sid) return null;
  return sessions.get(sid) ?? null;
}

module.exports = { createSession, getSession };
