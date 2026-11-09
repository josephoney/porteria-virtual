export interface Building {
  id: string;
  communityId: string;
  name: string;
  code: string | null;
  floors: number | null;
  createdAt: Date;
  updatedAt: Date;
}
