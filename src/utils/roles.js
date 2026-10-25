// Roles for web accounts. "officer" is the value stored in the database.
export const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "officer", label: "Agricultural Officer" },
  { value: "farmer", label: "Farmer" },
];

export function getRoleLabel(value) {
  const role = ROLES.find((r) => r.value === value);
  return role ? role.label : value;
}
