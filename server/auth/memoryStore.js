// ./auth/memoryStore.js
import { randomUUID } from 'crypto';

const usersById = new Map();
const usersByEmail = new Map(); // email (lowercased) -> id

export function findUserById(id) {
  return usersById.get(id) || null;
}

export function findUserByEmail(email) {
  const id = usersByEmail.get(String(email).toLowerCase());
  return id ? usersById.get(id) : null;
}

export function createUser({ email, passwordHash, anonName }) {
  const id = randomUUID();
  const user = {
    id,
    _id: id,                 // keep _id for places that expect Mongo-style
    email,
    anonName: anonName || email.split('@')[0],
    passwordHash,
    createdAt: new Date(),
  };
  usersById.set(id, user);
  usersByEmail.set(email.toLowerCase(), id);
  return user;
}
