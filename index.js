// index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
require("dotenv").config();

// Rotas
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const userRoutes = require("./routes/user");
const sessionRoutes = require("./routes/session");

const app = express();
const PORT = process.env.PORT || 3001;

// Detecta se está em produção (Render)
const isProd = process.env.NODE_ENV === "production";

/* =============================================
   BASIC MIDDLEWARES
============================================= */
app.use(express.json());
app.use(cookieParser());

/* =============================================
   CORS
============================================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://node-veilfi-jtae.onrender.com", // <---- OBRIGATÓRIO
      process.env.FRONTEND_ORIGIN || ""
    ],
    credentials: true,
  })
);


/* =============================================
   EXPRESS-SESSION (CORRIGIDO 100%)
============================================= */
app.use(
  session({
    name: process.env.SESSION_NAME || "sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,

      // 🔥 Aqui está a correção real:
      // localhost → HTTP: secure:false / sameSite:lax
      // produção → HTTPS: secure:true / sameSite:none
      secure: isProd ? true : false,
      sameSite: isProd ? "none" : "lax",

      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    },
  })
);

/* =============================================
   ROTAS
============================================= */
app.use("/auth", authRoutes);
app.use("/wallet", walletRoutes);
app.use("/user", userRoutes);
app.use("/session", sessionRoutes);

app.get("/", (req, res) => {
  res.send("API OK - Veilfi Backend Running");
});

/* ============================================= */
app.listen(PORT, () =>
  console.log(`🚀 Backend Veilfi rodando na porta ${PORT}`)
);
