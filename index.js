const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const env = require("./env");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: env.SERVER_MASTER_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// ROTAS
app.use("/auth", require("./routes/auth"));
app.use("/session", require("./routes/session"));
app.use("/user", require("./routes/user"));
app.use("/deposit", require("./routes/deposit"));
app.use("/swap/buy", require("./routes/buy"));

app.listen(env.PORT, () => {
  console.log(`Servidor rodando na porta ${env.PORT}`);
});
