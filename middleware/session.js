// /middleware/session.js
const prisma = require("../prisma");

module.exports = async function sessionMiddleware(req, res, next) {
  try {
    const sessionId = req.cookies?.sessionId;

    if (!sessionId) {
      req.sessionObject = null;
      return next();
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || !session.user) {
      req.sessionObject = null;
      return next();
    }

    // Sessão válida → expõe user ao backend
    req.sessionObject = {
      id: session.user.id,
      email: session.user.email,
      walletPubkey: session.user.walletPubkey,
    };

    next();
  } catch (err) {
    console.error("Session middleware error:", err);
    req.sessionObject = null;
    next();
  }
};
