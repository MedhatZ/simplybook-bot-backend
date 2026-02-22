const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { createBooking } = require("../services/simplybook.service");
const { success, failure } = require("../utils/response");
const { sanitizeError } = require("../utils/errorSanitizer");

const router = express.Router();

/**
 * Validation schema for booking request
 */
const bookingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(5, "Phone must be at least 5 characters"),
  email: z.string().email("Invalid email format"),
  service_id: z.number().int().positive("Service ID must be a positive integer"),
  provider_id: z.number().int().positive("Provider ID must be a positive integer").optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, "Time must be HH:MM:SS format")
});

router.post(
  "/",
  validate(bookingSchema),
  async (req, res) => {
    try {
      const data = req.validatedData;

      const result = await createBooking({
        name: data.name,
        phone: data.phone,
        email: data.email,
        service_id: data.service_id,
        provider_id: data.provider_id || null,
        date: data.date,
        time: data.time
      });

      return success(res, result);

    } catch (error) {
      const safeMessage = sanitizeError(error, "create booking");
      return failure(res, safeMessage, 400);
    }
  }
);

module.exports = router;