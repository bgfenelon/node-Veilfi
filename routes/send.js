import React, { useState, useEffect } from "react";
import { postJSON, getJSON } from "../../services/api";

export default function SendPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    getJSON("/session/me").then((res) => {
      if (res.ok) setFrom(res.user.walletPubkey);
    });
  }, []);

  async function send() {
    setResult(null);

    const res = await postJSON("/wallet/send", {
      to,
      amount: Number(amount),
    });

    if (!res.ok) {
      setResult(res.error || "Erro");
    } else {
      setResult("Tx: " + res.signature);
    }
  }

  return (
    <div>
      <h1>Send</h1>

      <input value={from} disabled />

      <input
        placeholder="Destination"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />

      <input
        placeholder="Amount (SOL)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={send}>Send</button>

      {result && <p>{result}</p>}
    </div>
  );
}
