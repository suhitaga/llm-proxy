type User = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
};

type AppEnv = {
  Variables: {
    user: User;
  };
};

export type { User, AppEnv };
