import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ClsService } from 'nestjs-cls';
import { AuthGuard } from '../auth';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { RedisService } from '../redis/redis.service';

describe('IntegrationController', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockIntegrationService = {
    parseDocument: jest.fn(),
    getTrackingInfo: jest.fn(),
    getExchangeRate: jest.fn(),
  };

  const mockRedisService = {
    checkRateLimit: jest.fn(),
  };

  const mockClsService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'dev-super-secret-key',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [IntegrationController],
      providers: [
        AuthGuard,
        { provide: IntegrationService, useValue: mockIntegrationService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ClsService, useValue: mockClsService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /integration/parse-doc 未帶 token 應回 401', async () => {
    await request(app.getHttpServer())
      .post('/integration/parse-doc')
      .attach('file', Buffer.from('hello'), 'demo.txt')
      .expect(401);
  });

  it('POST /integration/parse-doc 帶有效 token 應通過並呼叫 service', async () => {
    const token = jwtService.sign({
      sub: 'user_001',
      tenantId: 'tenant_001',
      role: 'BOSS',
      email: 'boss@example.com',
    });

    mockIntegrationService.parseDocument.mockResolvedValue({
      status: 'success',
      tenant_id: 'tenant_001',
    });

    const response = await request(app.getHttpServer())
      .post('/integration/parse-doc')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello'), 'demo.txt')
      .expect(201);

    expect(response.body).toEqual({
      status: 'success',
      tenant_id: 'tenant_001',
    });
    expect(mockIntegrationService.parseDocument).toHaveBeenCalledTimes(1);
    expect(mockClsService.set).toHaveBeenCalledWith('tenant_id', 'tenant_001');
    expect(mockClsService.set).toHaveBeenCalledWith('user_id', 'user_001');
  });
});
