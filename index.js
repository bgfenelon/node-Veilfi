require("dotenv").config();
console.log("SUPPORTED_MINTS:", process.env.SUPPORTED_MINTS);
const tokenRoutes = require("./tokens");


const express = require("express");
const cors = require("cors");
const app = express();
app.use("/api/tokens", tokenRoutes);

app.use(cors());
app.use(express.json());   // <-- OBRIGATÓRIO
app.use(express.urlencoded({ extended: true })); // opcional

// rotate
const userRoutes = require("./routes/user");
const activityRoutes = require("./routes/activity");
const withdrawRoutes = require("./routes/withdraw");

// mount
app.use("/user", userRoutes);
app.use("/activity", activityRoutes);
app.use("/withdraw", withdrawRoutes);   // <-- AQUI

// start
app.listen(process.env.PORT || 3001, () => {
  console.log("Server listening on", process.env.PORT || 3001);
});

const { start: startDepositTracker } = require("./services/depositTracker");
startDepositTracker();
