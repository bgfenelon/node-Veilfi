// server/routes/swap.js
const express = require("express");
const router = express.Router();

const swapController = require("../controllers/swapController");

// GET /swap/price
router.get("/price", swapController.getPrice);

// prepare endpoints
router.post("/prepare/buy", swapController.prepareBuy);
router.post("/prepare/sell", swapController.prepareSell);

// admin / debug
router.get("/orders", swapController.listOrders);
router.get("/orders/:id", swapController.getOrder);

module.exports = router;
