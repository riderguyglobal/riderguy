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

  // ── Targeted auto-dispatch offers ──
  'job:offer': (data: JobOffer) => void;
  'job:offer:expired': (data: { orderId: string }) => void;
  'job:offer:taken': (data: { orderId: string }) => void;

  // ── Generic notification ──
  'notification': (data: { title: string; body: string; orderId?: string }) => void;

  // ── Community Chat (Sprint 11) ──
  'community:message': (data: CommunityChatMessage) => void;
  'community:typing': (data: CommunityTypingIndicator) => void;
  'community:memberJoined': (data: { roomId: string; userId: string; firstName: string }) => void;
  'community:memberLeft': (data: { roomId: string; userId: string; firstName: string }) => void;

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

  // ── Respond to targeted job offers ──
  'job:offer:respond': (
    data: { orderId: string; response: 'accept' | 'decline' },
    ack?: (response: { success: boolean; error?: string }) => void,
  ) => void;

  // ── Community Chat (Sprint 11) ──
  'community:join': (
    data: { roomId: string },
    ack?: (response: { success: boolean }) => void,
  ) => void;
  'community:leave': (data: { roomId: string }) => void;
  'community:send': (
    data: { roomId: string; content: string; type?: string; mediaUrl?: string; replyToId?: string },
    ack?: (response: { success: boolean; messageId?: string }) => void,
  ) => void;
  'community:typing': (data: { roomId: string }) => void;
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

/** Targeted job offer sent to the best-matching rider */
export interface JobOffer {
  orderId: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  estimatedDurationMinutes: number;
  totalPrice: number;
  serviceFee: number;
  riderEarnings: number;
  packageType: string;
  packageDescription?: string;
  currency: string;
  distanceToPickup: number; // km from rider to pickup
  expiresAt: string;        // ISO timestamp — 30s window
}

// ── Community Chat Data Shapes (Sprint 11) ──

export interface CommunityChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  type: 'TEXT' | 'IMAGE' | 'VOICE' | 'SYSTEM';
  content: string;
  mediaUrl?: string | null;
  replyToId?: string | null;
  reactions?: Record<string, string[]>;
  createdAt: string;
}

export interface CommunityTypingIndicator {
  roomId: string;
  userId: string;
  firstName: string;
}
