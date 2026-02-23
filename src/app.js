const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const axios = require("axios");
const OpenAI = require("openai");
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

// IMPORTANT: Twilio sends x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// =======================
// OpenAI Setup
// =======================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =======================
// WhatsApp Webhook
// =======================
app.post("/whatsapp", async (req, res) => {
  try {
    const userMessage = req.body.Body;

    if (!userMessage) {
      return res.send(`<Response><Message>Empty message</Message></Response>`);
    }

    // 1️⃣ Ask AI to understand intent
    const ai = await openai.responses.create({
      model: "gpt-4.1",
      input: userMessage
    });

    const aiText = ai.output_text || "";

    // 2️⃣ Example: basic availability trigger
    if (aiText.toLowerCase().includes("availability")) {

      const availabilityResponse = await axios.post(
        `http://localhost:${process.env.PORT || 3000}/api/availability`,
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

    // Default AI reply
    return res.send(`
      <Response>
        <Message>${aiText}</Message>
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