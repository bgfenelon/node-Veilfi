function normalizeSecretKey(secretKey) {
  try {
    // Caso seja string JSON → transformar em array
    if (typeof secretKey === "string" && secretKey.startsWith("[")) {
      const arr = JSON.parse(secretKey);
      return Array.isArray(arr) && arr.length === 64 ? arr : null;
    }

    // Caso seja array real
    if (Array.isArray(secretKey) && secretKey.length === 64) {
      return [...secretKey]; // ← CÓPIA
    }

    // Caso seja string base58 Phantom → ignorar
    if (typeof secretKey === "string") {
      return null; // swap não aceita base58, somente o import
    }

    return null;

  } catch {
    return null;
  }
}
