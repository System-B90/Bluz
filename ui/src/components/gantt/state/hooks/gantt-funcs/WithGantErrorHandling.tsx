/**
 * Wraps asynchronous Gantt API calls with standardized error handling and logging.
 */
export async function withGantErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
    throw error;
  }
}
