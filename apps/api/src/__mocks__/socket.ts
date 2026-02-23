// Mock socket module for tests
const mockIO = {
  to: () => mockIO,
  emit: () => {},
};

export function getIO() {
  return mockIO;
}

export function emitOrderStatusUpdate() {}
export function emitNewJob() {}
