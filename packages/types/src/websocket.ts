// ============================================================
// WebSocket Event Types — shared between API and all frontends
// ============================================================

/** Events emitted FROM the server TO clients */
export interface ServerToClientEvents {
  // ── Location tracking ──
  'rider:location': (data: RiderLocationUpdate) => void;

  // ── Order status updates ──
  'order:status': (data: OrderStatusUpdate) => void;

  // ── In-app messaging ──
  'message:new': (data: ChatMessage) => void;
  'message:typing': (data: TypingIndicator) => void;

  // ── Dispatch / job notifications ──
  'job:new': (data: NewJobNotification) => void;
  'job:cancelled': (data: { orderId: string; reason?: string }) => void;

  // ── Generic notification ──
  'notification': (data: { title: string; body: string; orderId?: string }) => void;

  // ── Connection / errors ──
  'error': (data: { code: string; message: string }) => void;
}

/** Events emitted FROM the client TO the server */
export interface ClientToServerEvents {
  // ── Rider emits their location ──
  'rider:updateLocation': (
    data: { latitude: number; longitude: number; heading?: number; speed?: number },
    ack?: (response: { success: boolean }) => void,
  ) => void;

  // ── Join/leave rooms for live updates ──
  'order:subscribe': (data: { orderId: string }) => void;
  'order:unsubscribe': (data: { orderId: string }) => void;

  // ── Messaging ──
  'message:send': (
    data: { orderId: string; content: string },
    ack?: (response: { success: boolean; messageId?: string }) => void,
  ) => void;
  'message:typing': (data: { orderId: string }) => void;
}

/** Data shapes */

export interface RiderLocationUpdate {
  orderId: string;
  riderId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

export interface OrderStatusUpdate {
  orderId: string;
  orderNumber: string;
  status: string;
  previousStatus: string;
  actor: string;
  note?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderRole: 'rider' | 'client' | 'admin';
  content: string;
  timestamp: string;
}

export interface TypingIndicator {
  orderId: string;
  senderId: string;
  senderName: string;
}

export interface NewJobNotification {
  orderId: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  totalPrice: number;
  packageType: string;
}
