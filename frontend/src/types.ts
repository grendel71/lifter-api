export interface UserPublic {
  id: string;
  name: string;
}

export interface LifterResponse {
  lifter_id: string;
  squat: number;
  bench: number;
  deadlift: number;
  total: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  squat: number;
  bench: number;
  deadlift: number;
  total: number;
}

export interface CreateUserPayload {
  name: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UpdateUserPayload {
  name?: string;
  squat?: number;
  bench?: number;
  deadlift?: number;
}

export interface InviteTokenResponse {
  invite_token: string;
}
