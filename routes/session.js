const express = require("express");
const router = express.Router();

router.get("/me", (req, res) => {
  if (!req.session.user) return res.json({ ok: false });

  return res.json({
    ok: true,
    user: req.session.user,
  });
});

module.exports = router;
