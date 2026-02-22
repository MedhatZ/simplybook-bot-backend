const express = require("express");
const { z } = require("zod");
const { DateTime } = require("luxon");

const validate = require("../middleware/validate");
const { getBookingDetails, rescheduleBooking, getAvailability } = require("../services/simplybook.service");
const { success, failure } = require("../utils/response");
const { sanitizeError } = require("../utils/errorSanitizer");

const router = express.Router();

/**
 * Validation schema
 */
const rescheduleSchema = z.object({
  booking_id: z.string().min(1),
  booking_hash: z.string().min(1),
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  new_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, "Time must be HH:MM:SS format")
});

router.post(
  "/",
  validate(rescheduleSchema),
  async (req, res) => {
    try {
      const { booking_id, booking_hash, new_date, new_time } = req.validatedData;

      const SALON_TZ = process.env.SALON_TIMEZONE || "Asia/Singapore";

      // 1️⃣ Fetch original booking
      const booking = await getBookingDetails(booking_id, booking_hash);

      if (!booking || !booking.start_date_time || !booking.end_date_time) {
        return failure(res, "Booking not found.", 404);
      }

      // 2️⃣ Parse original start & end
      const originalStart = DateTime.fromFormat(
        booking.start_date_time,
        "yyyy-MM-dd HH:mm:ss",
        { zone: SALON_TZ }
      );

      const originalEnd = DateTime.fromFormat(
        booking.end_date_time,
        "yyyy-MM-dd HH:mm:ss",
        { zone: SALON_TZ }
      );

      if (!originalStart.isValid || !originalEnd.isValid) {
        return failure(res, "Invalid booking time format.", 500);
      }

      // 3️⃣ Apply configurable reschedule rule on ORIGINAL appointment time
      const MIN_RESCHEDULE_HOURS = Number(process.env.MIN_RESCHEDULE_HOURS || 24);
      const now = DateTime.now().setZone(SALON_TZ);
      const diffHours = originalStart.diff(now, "hours").hours;

      if (diffHours < MIN_RESCHEDULE_HOURS) {
        return failure(
          res,
          `Bookings can only be changed at least ${MIN_RESCHEDULE_HOURS} hour${MIN_RESCHEDULE_HOURS !== 1 ? 's' : ''} in advance.`,
          400
        );
      }

      // 4️⃣ Calculate original duration (in minutes)
      const durationMinutes = Math.round(
        originalEnd.diff(originalStart, "minutes").minutes
      );

      // 5️⃣ Build new start & end
      const newStart = DateTime.fromISO(
        `${new_date}T${new_time}`,
        { zone: SALON_TZ }
      );

      if (!newStart.isValid) {
        return failure(res, "Invalid new date or time.", 400);
      }

      const newEnd = newStart.plus({ minutes: durationMinutes });

      // 6️⃣ Check availability for new time slot
      const availableSlots = await getAvailability(
        booking.event_id,  // service_id from booking details
        new_date,
        booking.unit_id    // provider_id from booking details if available
      );

      // Verify new_time is in available slots
      const isTimeAvailable = availableSlots.some(slot => slot.time === new_time);
      if (!isTimeAvailable) {
        return failure(
          res,
          "Selected time is no longer available. Please choose another slot.",
          400
        );
      }

      // 7️⃣ Call reschedule service
      const result = await rescheduleBooking(
        booking_id,
        booking_hash,
        new_date,
        new_time,
        newEnd.toFormat("HH:mm:ss")
      );

      return success(res, {
        old_start: booking.start_date_time,
        new_start: newStart.toFormat("yyyy-MM-dd HH:mm:ss"),
        new_end: newEnd.toFormat("yyyy-MM-dd HH:mm:ss"),
        moved: result === true
      });

    } catch (error) {
      console.error("Reschedule error:", error);
      const safeMessage = sanitizeError(error, "reschedule booking");
      return failure(res, safeMessage, 400);
    }
  }
);

module.exports = router;