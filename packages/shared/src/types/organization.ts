export interface Organization {
  id: string;
  name: string;
  municipality: string | null;
  department: string | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
}
