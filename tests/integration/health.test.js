const request = require("supertest");
const app = require("../../src/app");

describe("Health (integration)", () => {
  it("GET / doit répondre ok", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
