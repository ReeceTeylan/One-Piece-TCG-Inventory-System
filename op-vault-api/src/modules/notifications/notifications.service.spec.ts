import { ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
describe('Notification ownership controls', () => {
  const db: any = { notification: {
    findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({count: 0}), delete: jest.fn(),
  } };
  const service = new NotificationsService(db);
  beforeEach(() => jest.clearAllMocks());
  it('does not let staff mark a global broadcast read', async () => {
    db.notification.findUnique.mockResolvedValueOnce({id:'global',userId:null});
    await expect(service.markRead('global','staff','STAFF')).rejects.toThrow(ForbiddenException);
    expect(db.notification.update).not.toHaveBeenCalled();
  });
  it('scopes staff mark-all-read to their own rows', async () => {
    await service.markAllRead('staff','STAFF');
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: {isRead:false,userId:'staff'}, data: {isRead:true},
    });
  });
  it('does not let staff dismiss an owner notification', async () => {
    db.notification.findUnique.mockResolvedValueOnce({id:'private',userId:'owner'});
    await expect(service.dismiss('private','staff','STAFF')).rejects.toThrow(ForbiddenException);
    expect(db.notification.delete).not.toHaveBeenCalled();
  });
});
