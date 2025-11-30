// index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const userRoutes = require("./routes/user");
const sessionRoutes = require("./routes/session");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());

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

// 👉 NÃO USE sessionMiddleware
// ❌ app.use(sessionMiddleware);

app.use("/auth", authRoutes);
app.use("/wallet", walletRoutes);
app.use("/user", userRoutes);
app.use("/session", sessionRoutes);

app.get("/", (req, res) => {
  res.send("API OK - Veilfi Backend Running");
});

app.listen(PORT, () => console.log(`API running on port ${PORT}`));
