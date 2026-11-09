export interface User {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
