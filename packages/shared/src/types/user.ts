import type { UserRole } from '../enums/index.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  locationId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
