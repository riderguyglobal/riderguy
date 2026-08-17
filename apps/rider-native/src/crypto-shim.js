// React Native (Hermes) provides globalThis.crypto.getRandomValues natively.
// This shim prevents Metro from crashing on require('crypto') in shared packages.
module.exports = {};
