const fetch = require("node-fetch");

(async () => {
  const mint = "VSKXrgwu5mtbdSZS7Au81p1RgLQupWwYXX1L2cWpump";
  const url = `https://frontend-api.pump.fun/token/${mint}`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log("RAW:", text);
  } catch (e) {
    console.error("ERR:", e);
  }
})();
