const { getStore, json } = require("../lib/common");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." });
  const users = await getStore("portfolio-users");
  const admin = await users.get("admin", { type: "json" });
  return json(200, { registrationAvailable: !admin });
};
