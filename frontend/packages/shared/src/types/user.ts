export interface User {
  id: string;
  email: string;
  full_name: string;
  nif?: string;
  tax_regime: 'simplified' | 'organized';
  activity_code?: string;
  irs_category: string;
  gcal_calendar_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}
