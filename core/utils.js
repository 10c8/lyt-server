/**
 * Generates a random, 8 character string.
 * @returns The random string.
 */
function generateRandomId() {
  return Math.random().toString(36).slice(2);
}

module.exports = { generateRandomId };
