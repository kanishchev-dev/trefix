import { ValidationError } from '@nestjs/common';

import { ValidationException } from './validation.exception';

describe('ValidationException', () => {
  it('flattens nested class-validator errors into dotted paths', () => {
    const errors: ValidationError[] = [
      { property: 'name', constraints: { isNotEmpty: 'name should not be empty' }, children: [] },
      {
        property: 'schedule',
        children: [{ property: 'daysPerWeek', constraints: { max: 'daysPerWeek must not exceed 7' }, children: [] }],
      },
    ];

    const exception = ValidationException.fromValidationErrors(errors);

    expect(exception.code).toBe('VALIDATION_ERROR');
    expect(exception.errors).toEqual([
      { path: 'name', constraints: { isNotEmpty: 'name should not be empty' } },
      { path: 'schedule.daysPerWeek', constraints: { max: 'daysPerWeek must not exceed 7' } },
    ]);
  });
});
