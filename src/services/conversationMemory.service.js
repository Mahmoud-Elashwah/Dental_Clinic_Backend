const MAX_MEMORY_LENGTH = 10;
const sessions = new Map();

const normalizeSessionKey = (key) => String(key || "anonymous");

exports.addMessage = (sessionKey, role, text) => {
  const normalizedKey = normalizeSessionKey(sessionKey);
  const entry = {
    role,
    text: String(text || "").trim(),
    timestamp: new Date().toISOString(),
  };
  const memory = sessions.get(normalizedKey) || [];
  memory.push(entry);
  if (memory.length > MAX_MEMORY_LENGTH) {
    memory.shift();
  }
  sessions.set(normalizedKey, memory);
};

exports.getMemory = (sessionKey) => {
  const normalizedKey = normalizeSessionKey(sessionKey);
  return sessions.get(normalizedKey) || [];
};

exports.clearMemory = (sessionKey) => {
  const normalizedKey = normalizeSessionKey(sessionKey);
  sessions.delete(normalizedKey);
};
