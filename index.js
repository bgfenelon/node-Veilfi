// index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// MIDDLEWARE (corrigido)
const sessionMiddleware = require("./middleware/session");

// ROUTES
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const userRoutes = require("./routes/user");
const sessionRoutes = require("./routes/session");

const app = express();
const PORT = process.env.PORT || 3001;

// BODY + COOKIES
app.use(express.json());
app.use(cookieParser());

// CORS CONFIG
app.use(
  cors({
    origin: [
      "https://veilfi.space",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://veifi-vite.onrender.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

// SESSION MIDDLEWARE — obrigatório para /wallet/send e /user/balance
app.use(sessionMiddleware);

// ROUTES
app.use("/auth", authRoutes);
app.use("/wallet", walletRoutes);
app.use("/user", userRoutes);
app.use("/session", sessionRoutes);

// ROOT ROUTE
app.get("/", (req, res) => {
  res.send("API OK - Veilfi Backend Running");
});

// START
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
