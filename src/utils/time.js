const { DateTime } = require("luxon");

const SALON_TZ = process.env.SALON_TIMEZONE || "Asia/Singapore";

const isAtLeast24HoursAway = (date, time) => {
  const now = DateTime.now().setZone(SALON_TZ);

  const appointment = DateTime.fromISO(
    `${date}T${time}`,
    { zone: SALON_TZ }
  );

  const diffHours = appointment.diff(now, "hours").hours;

  return diffHours >= 24;
};

module.exports = {
  isAtLeast24HoursAway
};