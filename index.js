// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const swapBuyInit = require("./routes/swapBuyInit");
const swapBuyConfirm = require("./routes/swapBuyConfirm");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

// Rotas oficiais de compra
app.use("/swap", swapBuyInit);
app.use("/swap", swapBuyConfirm);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Server rodando na porta " + PORT));
