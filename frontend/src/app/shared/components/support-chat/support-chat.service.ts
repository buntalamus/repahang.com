import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

export interface ChatMessage {
  id: number; body: string; is_admin: number; created_at: string; sender_name: string;
}
export interface ChatThread {
  user_id: number; nama_penuh: string; role: string; daerah: string | null;
  preview: string; is_admin: number; unread_count: number; updated_at: string;
}
export interface ChatResult {
  error: boolean; message?: string; data?: ChatMessage[]; has_more?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SupportChatService {
  private readonly api = inject(ApiService);
  summary() { return this.api.get<{ error: boolean; unread_count: number }>('support-chat.php', { action: 'summary' }); }
  threads(page: number, search: string) {
    return this.api.get<{ error: boolean; data: ChatThread[]; total: number }>('support-chat.php', {
      action: 'threads', page: String(page), search,
    });
  }
  messages(userId: number, cursor: Record<string, string> = {}) {
    return this.api.get<ChatResult>('support-chat.php', { user_id: String(userId), ...cursor });
  }
  send(userId: number, text: string, clientId: string) {
    return this.api.post<{ error: boolean; message?: string; message_id: number }>('support-chat.php', {
      action: 'send', user_id: userId, body: text, client_id: clientId,
    });
  }
  read(userId: number, through: number) {
    return this.api.post<{ error: boolean }>('support-chat.php', { action: 'read', user_id: userId, through_id: through });
  }
}
