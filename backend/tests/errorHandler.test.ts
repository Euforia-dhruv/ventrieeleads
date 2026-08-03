import {
  errorHandler,
  NotFoundError,
  ValidationError,
  DatabaseError
} from '../src/core/errorHandler';

describe('Error Classes', () => {
  describe('NotFoundError', () => {
    it('should create error with correct name and message', () => {
      const err = new NotFoundError('Lead not found');
      expect(err.name).toBe('NotFoundError');
      expect(err.message).toBe('Lead not found');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should create error with message and empty errors array by default', () => {
      const err = new ValidationError('Invalid input');
      expect(err.name).toBe('ValidationError');
      expect(err.message).toBe('Invalid input');
      expect(err.errors).toEqual([]);
    });

    it('should accept custom errors array', () => {
      const errors = [{ field: 'email', message: 'required' }];
      const err = new ValidationError('Invalid input', errors);
      expect(err.errors).toEqual(errors);
    });
  });

  describe('DatabaseError', () => {
    it('should create error with correct name and message', () => {
      const err = new DatabaseError('Connection failed');
      expect(err.name).toBe('DatabaseError');
      expect(err.message).toBe('Connection failed');
    });
  });
});

describe('errorHandler', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      url: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent')
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle ValidationError with 400 status', () => {
    const err = new ValidationError('Bad input', [{ field: 'name' }]);
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Bad input',
      errors: [{ field: 'name' }]
    });
  });

  it('should handle NotFoundError with 404 status', () => {
    const err = new NotFoundError('Not found');
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not found'
    });
  });

  it('should handle generic Error with 500 status in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Something broke');
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error'
    });
  });

  it('should handle generic Error with 500 status in development with message', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Debug info');
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    const call = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(call.success).toBe(false);
    expect(call.message).toBe('Debug info');
    expect(call.stack).toBeDefined();
  });

  it('should handle errors with custom status', () => {
    const err = new Error('Forbidden') as any;
    err.status = 403;
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
  });
});
