import { USE_SAMPLE_DATA } from "./config";

// Temporary web accounts for the Users page. Remove when /api/users matches the contract.
const sampleUsers = [
  { id: 1, full_name: "PinePal Administrator", username: "admin", role: "admin", created_at: "2026-01-10T08:00:00" },
  { id: 2, full_name: "Olivia Officer", username: "officer", role: "officer", created_at: "2026-03-02T09:30:00" },
  { id: 3, full_name: "Marco Agriculturist", username: "marco", role: "officer", created_at: "2026-05-19T14:10:00" },
];

export const mockUsers = USE_SAMPLE_DATA ? sampleUsers : [];
