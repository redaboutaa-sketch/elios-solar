/** Types partagés widget ↔ actions serveur (sans dépendance serveur). */

export type ChatAuthor = "CUSTOMER" | "ADVISOR" | "ASSISTANT" | "SYSTEM";

export interface ChatMessageDto {
  id: string;
  author: ChatAuthor;
  body: string;
  createdAt: string;
  meta: { kind?: string; handover?: boolean; configurationId?: string; shareToken?: string; quoteId?: string; orderId?: string } | null;
}

export interface ChatConversationDto {
  id: string;
  status: "OPEN" | "WAITING_CUSTOMER" | "CLOSED";
  offline: boolean;
  email: string | null;
  configurationId: string | null;
  assigned: boolean;
}

export interface ChatState {
  enabled: boolean;
  /** au moins un conseiller vu dans l'administration depuis < 5 min */
  online: boolean;
  offlineMessage: string;
  /** un assistant automatique est configuré (jamais affiché comme « IA » sinon) */
  assistant: boolean;
  signedIn: boolean;
  email: string | null;
  name: string | null;
  conversation: ChatConversationDto | null;
  messages: ChatMessageDto[];
  projects: Array<{ id: string; title: string }>;
}

export interface ChatPollResponse {
  messages: ChatMessageDto[];
  status: ChatConversationDto["status"];
  online: boolean;
  assigned: boolean;
}
