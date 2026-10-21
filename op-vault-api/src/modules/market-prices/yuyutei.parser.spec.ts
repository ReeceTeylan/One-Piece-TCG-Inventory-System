import { parseYuyuteiCardUrl } from './yuyutei.parser';

describe('parseYuyuteiCardUrl', () => {
  it('accepts a sell card link and normalises it', () => {
    expect(parseYuyuteiCardUrl(' https://yuyu-tei.jp/sell/opc/card/prb02/10217 ')).toEqual({
      ver: 'prb02', cid: '10217', listingKey: 'prb02/10217', url: 'https://yuyu-tei.jp/sell/opc/card/prb02/10217',
    });
    expect(parseYuyuteiCardUrl('https://yuyu-tei.jp/sell/opc/card/promo-op10/10083?x=1')?.listingKey).toBe('promo-op10/10083');
  });
  it('rejects other pages and sites', () => {
    expect(parseYuyuteiCardUrl('https://yuyu-tei.jp/buy/opc/card/prb02/10217')).toBeNull();
    expect(parseYuyuteiCardUrl('https://yuyu-tei.jp/sell/opc/s/search?search_word=op01-120')).toBeNull();
    expect(parseYuyuteiCardUrl('https://evil.example/sell/opc/card/prb02/10217')).toBeNull();
    expect(parseYuyuteiCardUrl('https://yuyu-tei.jp.evil.example/sell/opc/card/prb02/10217')).toBeNull();
  });
});
