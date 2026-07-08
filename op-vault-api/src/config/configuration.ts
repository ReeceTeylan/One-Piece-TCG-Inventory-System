export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:4000',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
});
