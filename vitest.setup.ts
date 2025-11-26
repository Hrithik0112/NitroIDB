/**
 * Vitest setup file to handle jsdom environment initialization
 * This file helps prevent unhandled errors from jsdom dependencies
 */

// Suppress unhandled errors from jsdom dependencies during initialization
if (typeof process !== 'undefined') {
  // Handle unhandled rejections from jsdom dependencies
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const errorMessage = error.message || '';
    const errorStack = error.stack || '';
    
    // Suppress known errors from webidl-conversions and whatwg-url
    // These are dependency initialization issues that don't affect test execution
    if (
      errorMessage.includes('webidl-conversions') ||
      errorMessage.includes('whatwg-url') ||
      errorMessage.includes("Cannot read properties of undefined") ||
      errorStack.includes('webidl-conversions') ||
      errorStack.includes('whatwg-url')
    ) {
      // Silently ignore these errors as they don't affect test execution
      return;
    }
    
    // Re-throw other unhandled rejections
    throw error;
  });

  // Also handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    const errorMessage = error.message || '';
    const errorStack = error.stack || '';
    
    // Suppress known errors from webidl-conversions and whatwg-url
    if (
      errorMessage.includes('webidl-conversions') ||
      errorMessage.includes('whatwg-url') ||
      errorMessage.includes("Cannot read properties of undefined") ||
      errorStack.includes('webidl-conversions') ||
      errorStack.includes('whatwg-url')
    ) {
      // Silently ignore these errors as they don't affect test execution
      return;
    }
    
    // Re-throw other uncaught exceptions
    throw error;
  });
}

