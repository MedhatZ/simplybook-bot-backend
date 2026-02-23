const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const routes = require("./routes");
const errorHandler = require("./middleware/error");
const apiLimiter = require("./middleware/rateLimit");

const app = express();

// =======================
// Middlewares
// =======================
app.use(helmet());
app.use(cors());

// Twilio sends x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// =======================
// WhatsApp Webhook (Deterministic – No AI)
// =======================
app.post("/whatsapp", async (req, res) => {
  try {
    const userMessage = req.body.Body?.toLowerCase();

    if (!userMessage) {
      return res.send(`<Response><Message>Empty message</Message></Response>`);
    }

    // 🔹 Simple Intent Detection
    if (userMessage.includes("availability") || userMessage.includes("متاح")) {

      const availabilityResponse = await axios.post(
        `http://127.0.0.1:${process.env.PORT || 3000}/api/availability`,
        {
          service_id: 1,
          date: "2026-02-24"
        }
      );

      const slots = availabilityResponse.data?.data || [];

      if (!slots.length) {
        return res.send(`
          <Response>
            <Message>لا توجد مواعيد متاحة.</Message>
          </Response>
        `);
      }

      const formatted = slots
        .slice(0, 5)
        .map(s => s.time)
        .join(", ");

      return res.send(`
        <Response>
          <Message>المواعيد المتاحة: ${formatted}</Message>
        </Response>
      `);
    }

    // Default fallback
    return res.send(`
      <Response>
        <Message>يرجى كتابة كلمة "availability" لمعرفة المواعيد المتاحة.</Message>
      </Response>
    `);

  } catch (err) {
    console.error("WhatsApp error:", err);
    return res.send(`
      <Response>
        <Message>حدث خطأ، حاول مرة أخرى.</Message>
      </Response>
    `);
  }
});

// =======================
// Rate limit for API only
// =======================
app.use("/api", apiLimiter);

// =======================
// Internal API routes
// =======================
app.use("/api", routes);

// =======================
// Health Check
// =======================
app.get("/", (req, res) => {
  res.json({ message: "SimplyBook Bot Backend running 🚀" });
});

// =======================
// Global Error Handler
// =======================
app.use(errorHandler);

module.exports = app;