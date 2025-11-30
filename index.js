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

// Detectar ambiente
const isProd = process.env.NODE_ENV === "production";

/* =============================================
   MIDDLEWARES BÁSICOS
============================================= */
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: [
      "http://localhost:5173",  // dev
      "https://veilfi.space",  // prod
      process.env.FRONTEND_ORIGIN,
    ].filter(Boolean),
    credentials: true, // necessário para enviar cookies
  })
);

/* =============================================
   EXPRESS-SESSION (CORRIGIDO PARA DEV E PROD)
============================================= */
app.use(
  session({
    name: process.env.SESSION_NAME || "sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,

      // 🔥 Em produção → HTTPS + SameSite None
      // 🔥 Em localhost → insecure permitido
      secure: isProd,                  
      sameSite: isProd ? "none" : "lax",

      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    },
  })
);

/* =============================================
   🔥 REMOVIDO: esse bloco quebrava a sessão
============================================= */
// app.use((req, res, next) => {
app.use((req, res, next) => {
  req.sessionObject = req.session.sessionObject || null;
  next();
  });
//   next();
// });

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
