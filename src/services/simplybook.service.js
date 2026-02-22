const axios = require("axios");
const crypto = require("crypto");

const BASE_URL = process.env.SIMPLYBOOK_BASE_URL; // https://user-api.simplybook.me
const COMPANY = process.env.SIMPLYBOOK_COMPANY;   // pageantlashes
const API_KEY = process.env.SIMPLYBOOK_API_KEY;   // plugin API key
const SECRET_KEY = process.env.SIMPLYBOOK_SECRET_KEY;

let token = null;
let loginPromise = null;

// Cache service durations (minutes) to avoid calling getEventList every time
let serviceDurationCache = null;
let serviceDurationFetchedAt = 0;
const SERVICE_DURATION_TTL_MS = 10 * 60 * 1000; // 10 min

function isRpcErrorInvalidToken(errMsg) {
  return /token/i.test(errMsg) || /unauthorized/i.test(errMsg);
}

async function login() {
  const response = await axios.post(`${BASE_URL}/login`, {
    jsonrpc: "2.0",
    method: "getToken",
    params: [COMPANY, API_KEY],
    id: 1
  });

  if (response.data?.error) {
    throw new Error(response.data.error.message || "Login failed");
  }

  token = response.data.result;
  return token;
}

async function rpcCall(method, params = []) {
  // Prevent concurrent login calls via shared promise
  if (!token) {
    if (!loginPromise) {
      loginPromise = login().finally(() => {
        loginPromise = null;
      });
    }
    token = await loginPromise;
  }

  const doCall = async () => {
    const response = await axios.post(
      `${BASE_URL}/`,
      { jsonrpc: "2.0", method, params, id: Date.now() },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Company-Login": COMPANY,
          "X-Token": token
        },
        timeout: 15000
      }
    );

    if (response.data?.error) {
      throw new Error(response.data.error.message || "RPC error");
    }

    return response.data.result;
  };

  try {
    return await doCall();
  } catch (err) {
    // Retry once if token is invalid/expired
    const msg = err?.message || "";
    if (isRpcErrorInvalidToken(msg)) {
      token = null;
      loginPromise = null;
      if (!loginPromise) {
        loginPromise = login().finally(() => {
          loginPromise = null;
        });
      }
      token = await loginPromise;
      return await doCall();
    }
    throw new Error(`RPC call failed (${method}): ${msg}`);
  }
}

async function getServiceDurationMinutes(serviceId) {
  const now = Date.now();
  if (
    serviceDurationCache &&
    now - serviceDurationFetchedAt < SERVICE_DURATION_TTL_MS
  ) {
    return serviceDurationCache[String(serviceId)] || null;
  }

  const events = await rpcCall("getEventList", []);
  // events is an object keyed by service id
  const map = {};
  for (const [id, ev] of Object.entries(events || {})) {
    const dur = Number(ev?.duration);
    if (Number.isFinite(dur)) map[id] = dur;
  }

  serviceDurationCache = map;
  serviceDurationFetchedAt = now;

  return map[String(serviceId)] || null;
}

function addMinutesToTime(startTimeHHMMSS, minutesToAdd) {
  const [h, m, s] = startTimeHHMMSS.split(":").map((x) => parseInt(x, 10));
  const d = new Date(2000, 0, 1, h, m, s || 0);
  d.setMinutes(d.getMinutes() + minutesToAdd);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Availability (Cartesian) -> returns [{provider_id, time}]
 * Supports optional time window filtering
 */
async function getAvailability(
  serviceId,
  date,
  providerId = null,
  fromTime = null,
  toTime = null
) {
  // If no window provided, fetch full day
  const from = fromTime
    ? `${date} ${fromTime}:00`
    : `${date} 00:00:00`;

  const to = toTime
    ? `${date} ${toTime}:00`
    : `${date} 23:59:59`;

  const unitParam = providerId ? Number(providerId) : 0;

  const result = await rpcCall("getCartesianStartTimeMatrix", [
    from,
    to,
    Number(serviceId),
    unitParam,
    1,
    0,
    []
  ]);

  const slots = [];

  for (const item of result || []) {
    const provider = item.provider_id;
    const times = item.timeslots?.[date] || [];

    for (const time of times) {
      slots.push({
        provider_id: provider,
        time // HH:MM:SS
      });
    }
  }

  return slots;
}

/**
 * Booking -> MUST match the working Postman call:
 * book(eventId, unitId, startDate, startTime, clientData, additional, count)
 */
async function createBooking(data) {
  const result = await rpcCall("book", [
    Number(data.service_id),
    Number(data.provider_id),
    data.date,       // YYYY-MM-DD
    data.time,       // HH:MM:SS (DON'T STRIP)
    {
      name: data.name,
      email: data.email,
      phone: data.phone
    },
    [],
    1 // IMPORTANT: matches your successful Postman request
  ]);

  const booking = result?.bookings?.[0];
  if (!booking) {
    throw new Error("Booking created but no booking data returned");
  }

  return {
    bookingId: booking.id,
    bookingHash: booking.hash,
    requirePayment: booking.require_payment ?? result.require_payment ?? false,
    startDateTime: booking.start_date_time,
    endDateTime: booking.end_date_time
  };
}

/**
 * Reschedule -> rescheduleBook(shedulerId, sign, startDate, startTime, endDate, endTime, additional, clientTimeOffset, clientTimezone)
 * sign = md5(bookingId + bookingHash + API_KEY)
 * @param {string} bookingId - The booking ID
 * @param {string} bookingHash - The booking hash
 * @param {string} newDate - New date YYYY-MM-DD
 * @param {string} newTime - New time HH:MM:SS
 * @param {number} serviceId - Service ID for duration lookup
 * @param {string} clientTimezone - Client timezone (default from env)
 * @param {number} clientTimeOffsetMinutes - UTC offset in minutes (default from env)
 */
async function rescheduleBooking(
  bookingId,
  bookingHash,
  newDate,
  newTime,
  calculatedEndTime
) {
 const sign = crypto
  .createHash("md5")
  .update(
    String(bookingId) +
    String(bookingHash) +
    String(SECRET_KEY)
  )
  .digest("hex");

  const SALON_TZ = process.env.SALON_TIMEZONE || "Asia/Singapore";
  const OFFSET_MIN = Number(process.env.SALON_UTC_OFFSET_MINUTES || 480);

  return await rpcCall("rescheduleBook", [
    Number(bookingId),
    sign,
    newDate,
    newTime,
    newDate,
    calculatedEndTime,
    [],
    OFFSET_MIN,
    SALON_TZ
  ]);
}

async function getBookingDetails(bookingId, bookingHash) {
  const sign = crypto
    .createHash("md5")
    .update(
      String(bookingId) +
      String(bookingHash) +
      String(SECRET_KEY)   // Using SECRET_KEY for signing as per rescheduleBook, assuming same auth pattern for getBookingDetails
    )
    .digest("hex");

  return await rpcCall("getBookingDetails", [
    Number(bookingId),
    sign
  ]);
}
module.exports = {
  login,
  rpcCall,
  getAvailability,
  createBooking,
  rescheduleBooking,
  getBookingDetails
};