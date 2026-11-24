import type { BitacoraEntryType, BitacoraResult, BitacoraSource } from '../enums/index.js';

export interface BitacoraEntryDto {
  id: string;
  communityId: string;
  /** Nombre de la comunidad, para mostrar la bitácora global o multi-comunidad. */
  communityName: string | null;
  accessPointId: string;
  accessPointName: string;
  destinationLocationUnitId: string | null;
  destinationPath: string | null;
  authorizedByPersonId: string | null;
  authorizedByName: string | null;
  shiftId: string | null;
  type: BitacoraEntryType;
  /** Resultado legible derivado del tipo y del motivo. */
  result: BitacoraResult;
  source: BitacoraSource;
  /** Quién operó la portería (actor del evento); ausente en eventos de sistema. */
  guardPersonId: string | null;
  guardName: string | null;
  authorName: string | null;
  passId: string | null;
  passScanId: string | null;
  summary: string;
  details: Record<string, unknown>;
  commentCount: number;
  /** True when the visitor never left and the pass window already ended. */
  missingExitAlert: boolean;
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
