const { bearerToken, getStore, json } = require("../lib/common");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { success: false, error: "Method not allowed." });
  const token = bearerToken(event);
  if (token) {
    const sessions = await getStore("portfolio-sessions");
    await sessions.delete(token);
  }
  return json(200, { success: true });
};
