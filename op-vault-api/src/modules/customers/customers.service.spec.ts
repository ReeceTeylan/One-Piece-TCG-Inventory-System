import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersRepository } from './customers.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findByNameAndContact: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'c1', name: 'Juan' }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: CustomersRepository, useValue: repo },
        { provide: PrismaService, useValue: {} },
        { provide: ActivityLogsService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(CustomersService);
  });

  it('creates a new customer', async () => {
    repo.findByNameAndContact.mockResolvedValue(null);
    const res = await service.create({ name: 'Juan', contactNumber: '0917' } as any, 'u1');
    expect(res.id).toBe('c1');
  });

  it('detects duplicate name + contact', async () => {
    repo.findByNameAndContact.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({ name: 'Juan', contactNumber: '0917' } as any, 'u1'),
    ).rejects.toThrow(ConflictException);
  });
});
