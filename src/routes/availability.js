const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { getAvailability } = require("../services/simplybook.service");
const { success, failure } = require("../utils/response");
const { sanitizeError } = require("../utils/errorSanitizer");

const router = express.Router();

/**
 * Validation schema
 */
const availabilitySchema = z.object({
  service_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  from_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  to_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  provider_id: z.number().int().positive().optional()
});

router.post(
  "/",
  validate(availabilitySchema),
  async (req, res) => {
    try {
      const {
        service_id,
        date,
        from_time,
        to_time,
        provider_id
      } = req.validatedData;

   const slots = await getAvailability(
  service_id,
  date,
  provider_id,
  from_time,
  to_time
);

      let filteredSlots = slots;

      // If time window provided, filter results
      if (from_time && to_time) {
        const from = `${from_time}:00`;
        const to = `${to_time}:00`;

        filteredSlots = slots.filter(slot => {
          return slot.time >= from && slot.time <= to;
        });
      }

      return success(res, filteredSlots);

    } catch (error) {
      const safeMessage = sanitizeError(error, "fetch availability");
      return failure(res, safeMessage, 400);
    }
  }
);

module.exports = router;