const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");
const errorHandler = require("./middleware/error");
const apiLimiter = require("./middleware/rateLimit");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limit for API
app.use("/api", apiLimiter);

// API routes
app.use("/api", routes);

app.get("/", (req, res) => {
  res.json({ message: "SimplyBook Bot Backend running 🚀" });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;