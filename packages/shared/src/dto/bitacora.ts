import type { BitacoraEntryType, BitacoraSource } from '../enums/index.js';

export interface BitacoraEntryDto {
  id: string;
  communityId: string;
  accessPointId: string;
  accessPointName: string;
  shiftId: string | null;
  type: BitacoraEntryType;
  source: BitacoraSource;
  authorName: string | null;
  passId: string | null;
  passScanId: string | null;
  summary: string;
  details: Record<string, unknown>;
  commentCount: number;
  createdAt: string;
}

export interface BitacoraCommentDto {
  id: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface BitacoraEntryDetailDto extends BitacoraEntryDto {
  comments: BitacoraCommentDto[];
}

export interface CreateBitacoraEntryDto {
  accessPointId: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface CreateBitacoraCommentDto {
  body: string;
}

export interface BitacoraListResponse {
  items: BitacoraEntryDto[];
  page: number;
  pageSize: number;
  total: number;
}
