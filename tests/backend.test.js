const jwt = require("jsonwebtoken");
const request = require("supertest");

jest.mock("../src/models/Users", () => ({
  findById: jest.fn(() => ({
    select: jest.fn().mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      id: "507f1f77bcf86cd799439011",
      role: "patient",
      isActive: true,
      tokenVersion: 0,
      email: "patient@example.com",
      changePassword: () => false,
    }),
  })),
  findOne: jest.fn(),
  create: jest.fn(),
}));

const app = require("../src/app");

describe("Dental Clinic backend baseline", () => {
  it("exposes a health check endpoint", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("serves Swagger UI documentation", async () => {
    const response = await request(app).get("/api-docs/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Swagger UI");
  });

  it("rejects invalid registration payloads", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "", email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });

  it("rejects invalid dental assessment payloads", async () => {
    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439011", tokenType: "access", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    const response = await request(app)
      .post("/api/v1/ai/dental-assessment")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });

  it("fails gracefully when Gemini API key is missing", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439011", tokenType: "access", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    delete process.env.GEMINI_API_KEY;

    const response = await request(app)
      .post("/api/v1/ai/dental-assessment")
      .set("Authorization", `Bearer ${token}`)
      .send({
        symptoms: ["tooth ache"],
        clinicalFindings: "sensitivity to cold",
        dentalHistory: "no prior treatment",
      });

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/Gemini|configuration/i);

    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });
});
