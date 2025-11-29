// server/server.js
const express = require("express");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const walletRoutes = require("./routes/wallet");
const { getSession } = require("./sessions");

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";

// =========================================
// ⭐ CORS FIX DEFINITIVO para Render + Cookies
// =========================================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://veilfi-vite.onrender.com",
  "https://veilfi.com",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// =========================================
// Body e Cookies
// =========================================
app.use(express.json());
app.use(cookieParser());

// =========================================
// Middleware de Sessão
// =========================================
app.use((req, res, next) => {
  const session = getSession(req);
  if (session) req.sessionObject = session;
  next();
});

// =========================================
// Rotas
// =========================================
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/wallet", walletRoutes);

app.get("/", (req, res) => {
  res.send("API Veilfi OK");
});

// =========================================
// Start
// =========================================
app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT} (prod=${isProduction})`);
});
