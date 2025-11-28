// sessions.js
const sessions = {};

function createSession(sessionId, walletPubkey, secretKey) {
  sessions[sessionId] = {
    walletPubkey,
    secretKey,        // <- ESSENCIAL
    createdAt: Date.now(),
  };
}

function getSession(id) {
  return sessions[id];
}

function destroySession(id) {
  delete sessions[id];
}

module.exports = {
  createSession,
  getSession,
  destroySession,
  sessions,
};
