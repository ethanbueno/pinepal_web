import { USE_SAMPLE_DATA } from "./config";

// Temporary sample data. Remove when the Flask /api/farmers routes work.
export const sampleFarmers = [
  { farmer_id: "F001", full_name: "Juan Domingo", farm_name: "Domingo Farm", municipality: "Cauayan City", farm_latitude: 16.93, farm_longitude: 121.77, farm_size_ha: 2.5, username: "jdomingo", is_active: true, registered_at: "2025-06-12T09:00:00" },
  { farmer_id: "F002", full_name: "Maria Santos", farm_name: "Santos Pineapple Farm", municipality: "Ilagan City", farm_latitude: 17.15, farm_longitude: 121.89, farm_size_ha: 4.0, username: "msantos", is_active: true, registered_at: "2025-06-20T10:30:00" },
  { farmer_id: "F003", full_name: "Pedro Reyes", farm_name: "Reyes Farm", municipality: "Santiago City", farm_latitude: 16.69, farm_longitude: 121.55, farm_size_ha: 1.8, username: "preyes", is_active: true, registered_at: "2025-07-02T08:15:00" },
  { farmer_id: "F004", full_name: "Ana Dela Cruz", farm_name: "Dela Cruz Farm", municipality: "Echague", farm_latitude: 16.7, farm_longitude: 121.68, farm_size_ha: 3.2, username: "adelacruz", is_active: true, registered_at: "2025-07-15T14:00:00" },
  { farmer_id: "F005", full_name: "Jose Ramos", farm_name: "Ramos Agri Farm", municipality: "Alicia", farm_latitude: 16.78, farm_longitude: 121.7, farm_size_ha: 5.5, username: "jramos", is_active: true, registered_at: "2025-08-01T11:20:00" },
  { farmer_id: "F006", full_name: "Rosa Mendoza", farm_name: "Mendoza Farm", municipality: "Angadanan", farm_latitude: 16.86, farm_longitude: 121.74, farm_size_ha: 2.1, username: "rmendoza", is_active: true, registered_at: "2025-08-18T09:45:00" },
  { farmer_id: "F007", full_name: "Carlos Bautista", farm_name: "Bautista Farm", municipality: "Jones", farm_latitude: 16.62, farm_longitude: 121.7, farm_size_ha: 3.0, username: "cbautista", is_active: false, registered_at: "2025-09-03T13:10:00" },
  { farmer_id: "F008", full_name: "Elena Garcia", farm_name: "Garcia Farm", municipality: "Ramon", farm_latitude: 16.73, farm_longitude: 121.66, farm_size_ha: 1.5, username: "egarcia", is_active: true, registered_at: "2025-09-10T15:30:00" },
  { farmer_id: "F009", full_name: "Mario Villanueva", farm_name: "Villanueva Farm", municipality: "Roxas", farm_latitude: 17.12, farm_longitude: 121.6, farm_size_ha: 6.0, username: "mvillanueva", is_active: true, registered_at: "2025-09-22T07:50:00" },
  { farmer_id: "F010", full_name: "Lita Aquino", farm_name: "Aquino Farm", municipality: "San Mateo", farm_latitude: 16.88, farm_longitude: 121.59, farm_size_ha: 2.8, username: "laquino", is_active: true, registered_at: "2025-10-05T12:00:00" },
];

export const mockFarmers = USE_SAMPLE_DATA ? sampleFarmers : [];
