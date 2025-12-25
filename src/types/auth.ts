export type AuthUser = {
  id: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
};

export type ApiMeResponse = {
  user?: {
    id?: string;
    sub?: string;
    username?: string;
    email?: string | null;
    avatar?: string | null;
  };
};
