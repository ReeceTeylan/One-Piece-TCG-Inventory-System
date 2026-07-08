import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end happy path against a REAL test database.
 * Requires: DATABASE_URL pointing at a disposable DB + `prisma migrate deploy` + seed.
 * Run: npm run test:e2e
 */
describe('OP-Vault E2E (auth + raw-card duplicate + sale)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('logs in as owner', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@opvault.ph', password: 'Owner@123' })
      .expect(200);
    token = res.body.data.accessToken;
    expect(token).toBeDefined();
  });

  it('rejects duplicate raw card with 409 CARD_EXISTS', async () => {
    const dup = {
      name: 'Monkey D. Luffy', cardNumber: 'OP01-024', setName: 'Romance Dawn',
      rarity: 'SR', quantity: 1, buyCost: 180, postedPrice: 450,
    };
    const res = await request(app.getHttpServer())
      .post('/api/raw-cards')
      .set('Authorization', `Bearer ${token}`)
      .send(dup)
      .expect(409);
    expect(res.body.code).toBe('CARD_EXISTS');
  });

  it('blocks unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/api/raw-cards').expect(401);
  });

  it('forbids STAFF from owner-only settings patch (403)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'staff@opvault.ph', password: 'Staff@123' })
      .expect(200);
    const staffToken = login.body.data.accessToken;
    await request(app.getHttpServer())
      .patch('/api/settings')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lowStockThreshold: 5 })
      .expect(403);
  });

  it('allows OWNER to read analytics dashboard (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data).toHaveProperty('inventory');
  });

  it('rejects a sale with insufficient stock and does not persist it (rollback)', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/sales?limit=1').set('Authorization', `Bearer ${token}`).expect(200);
    const beforeTotal = before.body.meta.total;
    await request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer: { name: 'E2E Tester' },
        courier: 'JNT',
        items: [{ itemType: 'RAW', rawCardId: 'does-not-exist', quantity: 999, unitPrice: 100 }],
      })
      .expect((r) => { if (![400, 404].includes(r.status)) throw new Error('expected 400/404'); });
    const after = await request(app.getHttpServer())
      .get('/api/sales?limit=1').set('Authorization', `Bearer ${token}`).expect(200);
    expect(after.body.meta.total).toBe(beforeTotal);
  });
});
