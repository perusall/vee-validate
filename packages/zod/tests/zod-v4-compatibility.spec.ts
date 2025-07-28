import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import { toTypedSchema } from '../src';

describe('Zod v4 Compatibility', () => {
  test('should work with new error syntax', async () => {
    const schema = z.object({
      email: z.string().email({ error: 'Invalid email format' }),
      age: z.number().min(18, { error: 'Must be at least 18 years old' }),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      email: 'invalid-email',
      age: 15,
    });

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].errors).toContain('Invalid email format');
    expect(result.errors[1].errors).toContain('Must be at least 18 years old');
  });

  test('should work with valid data', async () => {
    const schema = z.object({
      email: z.string().email({ error: 'Invalid email format' }),
      age: z.number().min(18, { error: 'Must be at least 18 years old' }),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      email: 'test@example.com',
      age: 25,
    });

    expect(result.value).toEqual({
      email: 'test@example.com',
      age: 25,
    });
    expect(result.errors).toHaveLength(0);
  });

  test('should handle optional fields correctly', async () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email().optional(),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      name: 'John Doe',
    });

    expect(result.value).toEqual({
      name: 'John Doe',
      email: undefined,
    });
    expect(result.errors).toHaveLength(0);
  });

  test('should handle union types correctly', async () => {
    const schema = z.object({
      type: z.union([z.literal('user'), z.literal('admin')]),
      data: z.union([z.string(), z.number()]),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      type: 'user',
      data: 'some string',
    });

    expect(result.value).toEqual({
      type: 'user',
      data: 'some string',
    });
    expect(result.errors).toHaveLength(0);
  });

  test('should handle array types correctly', async () => {
    const schema = z.object({
      tags: z.array(z.string()),
      scores: z.array(z.number()),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      tags: ['javascript', 'typescript'],
      scores: [85, 90, 95],
    });

    expect(result.value).toEqual({
      tags: ['javascript', 'typescript'],
      scores: [85, 90, 95],
    });
    expect(result.errors).toHaveLength(0);
  });

  test('should work with new top-level string validators', async () => {
    const schema = z.object({
      email: z.email({ error: 'Invalid email' }),
      uuid: z.uuid({ error: 'Invalid UUID' }),
      url: z.url({ error: 'Invalid URL' }),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      email: 'invalid-email',
      uuid: 'not-a-uuid',
      url: 'not-a-url',
    });

    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].errors).toContain('Invalid email');
    expect(result.errors[1].errors).toContain('Invalid UUID');
    expect(result.errors[2].errors).toContain('Invalid URL');
  });

  test('should handle record types correctly', async () => {
    const schema = z.object({
      config: z.record(z.string(), z.string()),
      scores: z.record(z.string(), z.number()),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      config: {
        theme: 'dark',
        language: 'en',
      },
      scores: {
        math: 95,
        science: 88,
      },
    });

    expect(result.value).toEqual({
      config: {
        theme: 'dark',
        language: 'en',
      },
      scores: {
        math: 95,
        science: 88,
      },
    });
    expect(result.errors).toHaveLength(0);
  });

  test('should handle enum records correctly', async () => {
    const UserRole = z.enum(['admin', 'user', 'guest']);
    const schema = z.object({
      permissions: z.record(UserRole, z.boolean()),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      permissions: {
        admin: true,
        user: false,
        guest: false,
      },
    });

    expect(result.value).toEqual({
      permissions: {
        admin: true,
        user: false,
        guest: false,
      },
    });
    expect(result.errors).toHaveLength(0);
  });

  test('should handle error maps correctly', async () => {
    const schema = z.object({
      age: z
        .number({
          error: issue => {
            if (issue.code === 'invalid_type') {
              return 'Age must be a number';
            }
            if (issue.code === 'too_small') {
              return `Age must be at least ${issue.minimum}`;
            }
            return 'Invalid age';
          },
        })
        .min(18),
    });

    const validator = toTypedSchema(schema);

    const result = await validator.parse({
      age: 'not-a-number',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].errors).toContain('Age must be a number');
  });
});
