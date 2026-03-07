// Suppress browser extension errors that are not related to our application
(function() {
  // Suppress "Could not establish connection" errors from browser extensions
  const originalError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    
    // Filter out common browser extension errors
    if (
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist') ||
      message.includes('Extension context invalidated') ||
      message.includes('Cross-Origin-Opener-Policy policy would block')
    ) {
      return; // Don't log these errors
    }
    
    // Log all other errors normally
    originalError.apply(console, args);
  };

  // Suppress unhandled promise rejections from extensions
  window.addEventListener('unhandledrejection', function(event) {
    const message = event.reason?.message || event.reason || '';
    
    if (
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist') ||
      message.includes('Extension context invalidated')
    ) {
      event.preventDefault(); // Prevent the error from being logged
    }
  });
})();