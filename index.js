// index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
require("dotenv").config();

// rotas
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const userRoutes = require("./routes/user");
const sessionRoutes = require("./routes/session");

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================
// MIDDLEWARES BÁSICOS
// =============================================
app.use(express.json());
app.use(cookieParser());

// CORS (origens permitidas)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://veilfi.space",
      process.env.FRONTEND_ORIGIN
    ].filter(Boolean),
    credentials: true,
  })
);

// =============================================
// SESSÃO (PARTE MAIS IMPORTANTE)
// =============================================
app.use(
  session({
    name: process.env.SESSION_NAME || "sid",
    secret: process.env.SESSION_SECRET || "development-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,

      // 🔥 CONFIGURAÇÃO ESSENCIAL PARA FUNCIONAR NO DOMÍNIO veilfi.space
      secure: true,       // obrigatório em HTTPS
      sameSite: "none",   // obrigatório para cookies cross-site

      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Compatibilidade com código existente
app.use((req, res, next) => {
  req.sessionObject = req.session.sessionObject || null;
  next();
});

// =============================================
// ROTAS
// =============================================
app.use("/auth", authRoutes);
app.use("/wallet", walletRoutes);
app.use("/user", userRoutes);
app.use("/session", sessionRoutes);

app.get("/", (req, res) => {
  res.send("API OK - Veilfi Backend Running");
});

// =============================================
app.listen(PORT, () =>
  console.log(`🚀 Backend Veilfi rodando na porta ${PORT}`)
);
