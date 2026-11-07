function assistantError(status, message) {
  return Object.assign(new Error(message), { status });
}

module.exports = assistantError;
