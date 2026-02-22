/**
 * Sanitize API errors to prevent information disclosure
 * Maps internal/API errors to safe, user-friendly messages
 */

function sanitizeError(error, context = "operation") {
  const message = error?.message || "";

  // Check for token/auth issues
  if (message.toLowerCase().includes("token") || message.toLowerCase().includes("unauthorized")) {
    return "Authentication failed. Please try again.";
  }

  // Check for validation errors from API
  if (message.toLowerCase().includes("validation") || message.toLowerCase().includes("invalid")) {
    return "Invalid request parameters.";
  }

  // Check for timeout errors
  if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("econnaborted")) {
    return "Request timed out. Please try again.";
  }

  // Check for network errors
  if (message.toLowerCase().includes("econnrefused") || message.toLowerCase().includes("network")) {
    return "Service unavailable. Please try again later.";
  }

  // Check for booking not found
  if (message.toLowerCase().includes("booking") && message.toLowerCase().includes("not found")) {
    return "Booking not found. Please verify the booking ID.";
  }

  // Default safe error message
  return `Failed to ${context}. Please try again later.`;
}

module.exports = {
  sanitizeError
};
