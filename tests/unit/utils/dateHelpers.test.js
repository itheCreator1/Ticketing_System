const { calculateTicketAge } = require('../../../utils/dateHelpers');

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

describe('dateHelpers', () => {
  describe('calculateTicketAge', () => {
    it('returns unit "new" with success color for tickets under 24 hours old', () => {
      const result = calculateTicketAge(hoursAgo(1));
      expect(result).toEqual({ unit: 'new', count: 0, color: 'success' });
    });

    it('returns unit "days" with info color for tickets 1-3 days old', () => {
      const result = calculateTicketAge(hoursAgo(48));
      expect(result.unit).toBe('days');
      expect(result.count).toBe(2);
      expect(result.color).toBe('info');
    });

    it('returns unit "days" with warning color for tickets 4-7 days old', () => {
      const result = calculateTicketAge(hoursAgo(5 * 24));
      expect(result.unit).toBe('days');
      expect(result.count).toBe(5);
      expect(result.color).toBe('warning');
    });

    it('returns unit "weeks" with danger color for tickets over 7 days old', () => {
      const result = calculateTicketAge(hoursAgo(20 * 24));
      expect(result.unit).toBe('weeks');
      expect(result.count).toBe(2);
      expect(result.color).toBe('danger');
    });

    it('accepts a string timestamp', () => {
      const result = calculateTicketAge(new Date(hoursAgo(1)).toISOString());
      expect(result.unit).toBe('new');
    });
  });
});
