// server/server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const userRoutes = require("./routes/user");
const sessionRoutes = require("./routes/session");

// 🔥 Middleware correto de sessão (mantém o req.sessionObject)
const sessionMiddleware = require("./middlewares/session");

const app = express();
const PORT = process.env.PORT || 3001;

// ---------- BASE CONFIG ----------
app.use(express.json());
app.use(cookieParser());

// ---------- CORS CORRIGIDO ----------
app.use(
  cors({
    origin: [
      "https://veilfi.space",      // seu domínio real
      "http://localhost:5173",     // desenvolvimento
      "http://localhost:5174",     // opcional
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.options("*", cors());

// ------------ MIDDLEWARE DE SESSÃO REAL -------------
app.use(sessionMiddleware);

// -------------- ROTAS -----------------
app.use("/auth", authRoutes);
app.use("/wallet", walletRoutes);
app.use("/user", userRoutes);
app.use("/session", sessionRoutes);

app.get("/", (req, res) => res.send("API OK"));

// -------------- INIT -------------------
app.listen(PORT, () => console.log("API ON PORT", PORT));
