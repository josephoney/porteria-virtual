export interface PublicOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface PublicCommunity {
  id: string;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  organization: PublicOrganization;
}
