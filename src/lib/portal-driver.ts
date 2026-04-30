// Portal-agnostic driver interface (PRD Section 10.6)
// IS24BrowserDriver (real) can replace IS24MockDriver without product code changes

export interface PublishInput {
  title: string;
  description: string;
  price: number;
  propertyType: string;
  livingArea: number;
  plotArea: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  yearBuilt: number | null;
  condition: string | null;
  attributes: string[];
  city: string;
  postcode: string;
  street: string;
  houseNumber: string;
  photos: string[];
  energyClass: string | null;
  energyValue: number | null;
  energyCertType: string | null;
  energyPrimarySource: string | null;
  sellerFirstName: string | null;
  sellerLastName: string | null;
  sellerEmail: string | null;
  sellerPhone: string | null;
}

export interface PublishResult {
  externalListingId: string;
  externalUrl: string;
}

export interface PortalStatSnapshot {
  impressions: number;
  detailViews: number;
  contactRequests: number;
  bookmarks: number;
}

export interface PortalLead {
  name: string;
  email: string;
  phone?: string;
  message?: string;
}

export interface PortalDriver {
  readonly portal: string;
  publish(input: PublishInput): Promise<PublishResult>;
  update(externalId: string, input: Partial<PublishInput>): Promise<void>;
  pause(externalId: string): Promise<void>;
  withdraw(externalId: string): Promise<void>;
  fetchStats(externalId: string): Promise<PortalStatSnapshot>;
  fetchLeads(externalId: string): Promise<PortalLead[]>;
}

// Mock driver for MVP — simulates IS24 operations
export class IS24MockDriver implements PortalDriver {
  readonly portal = "IMMOSCOUT24";

  async publish(input: PublishInput): Promise<PublishResult> {
    await this.simulateDelay();
    const id = `is24-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      externalListingId: id,
      externalUrl: `https://www.immobilienscout24.de/expose/${id}`,
    };
    void input;
  }

  async update(externalId: string): Promise<void> {
    await this.simulateDelay();
    void externalId;
  }

  async pause(externalId: string): Promise<void> {
    await this.simulateDelay();
    void externalId;
  }

  async withdraw(externalId: string): Promise<void> {
    await this.simulateDelay();
    void externalId;
  }

  async fetchStats(): Promise<PortalStatSnapshot> {
    await this.simulateDelay();
    return {
      impressions: Math.floor(Math.random() * 500) + 50,
      detailViews: Math.floor(Math.random() * 150) + 10,
      contactRequests: Math.floor(Math.random() * 20),
      bookmarks: Math.floor(Math.random() * 30) + 5,
    };
  }

  async fetchLeads(): Promise<PortalLead[]> {
    await this.simulateDelay();
    return [];
  }

  private simulateDelay(): Promise<void> {
    return new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
  }
}

export function getDriver(portal: string): PortalDriver {
  switch (portal) {
    case "IMMOSCOUT24":
      // Prefer REST API driver when consumer key is configured
      if (process.env.IS24_CONSUMER_KEY) {
        const { IS24ApiDriver } = require("./is24-api-driver");
        return new IS24ApiDriver();
      }
      // Fallback: browser automation (legacy)
      if (process.env.IS24_EMAIL && process.env.IS24_PASSWORD) {
        const { IS24BrowserDriver } = require("./is24-driver");
        return new IS24BrowserDriver();
      }
      return new IS24MockDriver();
    default:
      throw new Error(`Kein Treiber für Portal: ${portal}`);
  }
}
