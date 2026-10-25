import { mockProtocols } from "../mock/protocols";

// MOCK VERSION. Changes only last until the page is refreshed.

const protocols = [...mockProtocols];

const wait = (data) =>
  new Promise((resolve) => setTimeout(() => resolve(data), 300));

export const getProtocols = () => wait(protocols.map((p) => ({ ...p })));

export function createProtocol(data) {
  const newProtocol = {
    ...data,
    protocol_id: Date.now(),
    version: 1,
    updated_at: new Date().toISOString().slice(0, 19),
  };
  protocols.push(newProtocol);
  return wait({ ...newProtocol });
}

export function updateProtocol(id, data) {
  const found = protocols.find((p) => p.protocol_id === id);
  Object.assign(found, data, {
    version: found.version + 1, // the backend does this too
    updated_at: new Date().toISOString().slice(0, 19),
  });
  return wait({ ...found });
}

export function deleteProtocol(id) {
  const index = protocols.findIndex((p) => p.protocol_id === id);
  protocols.splice(index, 1);
  return wait(null);
}
