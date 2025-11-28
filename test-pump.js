const fetch = require("node-fetch");

(async () => {
  const mint = "2J8bP35XdfmRZCTj7WUdZ4TQGqaXcFj4kd6rpLYxpump";
  const url = `https://frontend-api.pump.fun/token/${mint}`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log("RAW:", text);
  } catch (e) {
    console.error("ERR:", e);
  }
})();
