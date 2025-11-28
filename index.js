// server/server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const walletRoutes = require("./routes/wallet");
const { getSession } = require("./sessions");

const app = express();
const PORT = process.env.PORT || 3001;

const isProduction = process.env.NODE_ENV === "production";

// ===============================
// CORS (com cookies)
// ===============================
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://veilfi-vite.onrender.com"
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.options("*", cors()); // preflight

app.use(express.json());
app.use(cookieParser());

// ===============================
// SESSION middleware
// Deixa req.sessionObject disponível
// ===============================
app.use((req, res, next) => {
  const sessionObject = getSession(req);
  if (sessionObject) req.sessionObject = sessionObject;
  next();
});

// ===============================
// ROTAS
// ===============================
app.use("/auth", authRoutes);     // /auth/import, /auth/login ...
app.use("/user", userRoutes);     // /user/balance (se existir) 
app.use("/wallet", walletRoutes); // /wallet/balance + /wallet/send

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("API Veilfi OK");
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT} — production=${isProduction}`);
});
