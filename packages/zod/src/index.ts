import { ZodObject, input, output, ZodDefault, ZodSchema, ZodIssue, ZodArray } from 'zod';
import { PartialDeep } from 'type-fest';
import { isNotNestedPath, type TypedSchema, type TypedSchemaError, cleanupNonNestedPath } from 'vee-validate';
import { isIndex, isObject, merge, normalizeFormPath } from '../../shared';

/**
 * Transforms a Zod object schema to Yup's schema
 */
export function toTypedSchema<
  TSchema extends ZodSchema,
  TOutput = output<TSchema>,
  TInput = PartialDeep<input<TSchema>>,
>(zodSchema: TSchema, opts?: any): TypedSchema<TInput, TOutput> {
  const schema: TypedSchema = {
    __type: 'VVTypedSchema',
    async parse(value: any) {
      const result = await zodSchema.safeParseAsync(value, opts);
      if (result.success) {
        return {
          value: result.data,
          errors: [],
        };
      }

      const errors: Record<string, TypedSchemaError> = {};
      processIssues(result.error.issues, errors);

      return {
        errors: Object.values(errors),
      };
    },
    cast(values: any) {
      try {
        return zodSchema.parse(values);
      } catch {
        // Zod does not support "casting" or not validating a value, so next best thing is getting the defaults and merging them with the provided values.
        const defaults = getDefaults(zodSchema);
        if (isObject(defaults) && isObject(values)) {
          return merge(defaults, values);
        }

        return values;
      }
    },
    describe(path: any) {
      try {
        if (!path) {
          return {
            required: !zodSchema.isOptional(),
            exists: true,
          };
        }

        const description = getSchemaForPath(path, zodSchema);
        if (!description) {
          return {
            required: false,
            exists: false,
          };
        }

        return {
          required: !description.isOptional(),
          exists: true,
        };
      } catch {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to describe path ${path} on the schema, returning a default description.`);
        }

        return {
          required: false,
          exists: false,
        };
      }
    },
  };

  return schema;
}

function processIssues(issues: ZodIssue[], errors: Record<string, TypedSchemaError>): void {
  issues.forEach(issue => {
    const path = normalizeFormPath(issue.path.join('.'));

    // Handle invalid_union errors - in Zod v4, union errors are handled differently
    if (issue.code === 'invalid_union') {
      // In Zod v4, union errors may have unionErrors property
      if ('unionErrors' in issue) {
        const unionIssue = issue as any;
        if (unionIssue.unionErrors) {
          processIssues(
            unionIssue.unionErrors.flatMap((ue: any) => ue.issues),
            errors,
          );
        }
      }

      if (!path) {
        return;
      }
    }

    if (!errors[path]) {
      errors[path] = { errors: [], path };
    }

    errors[path].errors.push(issue.message);
  });
}

// Zod does not support extracting default values so the next best thing is manually extracting them.
// https://github.com/colinhacks/zod/issues/1944#issuecomment-1406566175
function getDefaults<Schema extends ZodSchema>(schema: Schema): unknown {
  if (!(schema instanceof ZodObject)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(schema.shape).map(([key, value]) => {
      if (value instanceof ZodDefault) {
        return [key, (value as any)._def.defaultValue()];
      }

      if (value instanceof ZodObject) {
        return [key, getDefaults(value)];
      }

      return [key, undefined];
    }),
  );
}

/**
 * @deprecated use toTypedSchema instead.
 */
const toFieldValidator = toTypedSchema;

/**
 * @deprecated use toTypedSchema instead.
 */
const toFormValidator = toTypedSchema;

export { toFieldValidator, toFormValidator };

function getSchemaForPath(path: string, schema: ZodSchema): ZodSchema | null {
  if (!isObjectSchema(schema)) {
    return null;
  }

  if (isNotNestedPath(path)) {
    return (schema as any).shape[cleanupNonNestedPath(path)];
  }

  const paths = (path || '').split(/\.|\[(\d+)\]/).filter(Boolean);

  let currentSchema: ZodSchema = schema;
  for (let i = 0; i <= paths.length; i++) {
    const p = paths[i];
    if (!p || !currentSchema) {
      return currentSchema;
    }

    if (isObjectSchema(currentSchema)) {
      currentSchema = (currentSchema as any).shape[p] || null;
      continue;
    }

    if (isIndex(p) && isArraySchema(currentSchema)) {
      // In Zod v4, the internal structure may have changed
      currentSchema = (currentSchema as any)._def?.type || (currentSchema as any)._zod?.def?.type || null;
    }
  }

  return null;
}

function getDefType(schema: ZodSchema) {
  // In Zod v4, the internal structure has changed
  return (schema as any)._def?.typeName || (schema as any)._zod?.def?.typeName;
}

function isArraySchema(schema: ZodSchema): schema is ZodArray<any> {
  return getDefType(schema) === 'ZodArray';
}

function isObjectSchema(schema: ZodSchema): schema is ZodObject<any> {
  return getDefType(schema) === 'ZodObject';
}
