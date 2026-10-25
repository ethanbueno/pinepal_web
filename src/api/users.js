import { mockUsers } from "../mock/users";

// MOCK VERSION. Changes only last until the page is refreshed.

const users = [...mockUsers];

const wait = (data) =>
  new Promise((resolve) => setTimeout(() => resolve(data), 300));

export const getUsers = () => wait(users.map((u) => ({ ...u })));

export function createUser(data) {
  if (users.some((u) => u.username === data.username)) {
    return Promise.reject({ response: { status: 409, data: { error: "Username is already taken" } } });
  }
  const newUser = {
    id: Date.now(),
    full_name: data.full_name,
    username: data.username,
    role: data.role,
    created_at: new Date().toISOString().slice(0, 19),
  };
  users.push(newUser);
  return wait({ ...newUser });
}

export function updateUser(id, data) {
  const found = users.find((u) => u.id === id);
  found.full_name = data.full_name;
  found.username = data.username;
  found.role = data.role;
  return wait({ ...found });
}

export function deleteUser(id) {
  const index = users.findIndex((u) => u.id === id);
  users.splice(index, 1);
  return wait(null);
}
